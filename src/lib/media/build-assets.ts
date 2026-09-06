import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import sharp from 'sharp';
import { isMediaPath } from './paths.ts';
import { MAX_FILE_BYTES } from './validation.ts';
import { validateBuildFile } from './validation-build.ts';
import type { MediaCategory } from './types.ts';
import type { PublicSnapshot } from '../../types/content.ts';
import { markdownAssetIds } from './usage.ts';

export interface BuildAsset {
  id: string;
  public_url: string | null;
  visibility: string;
  filename: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  decorative: boolean;
  category: string;
}
export interface ImageVariant {
  src: string;
  width: number;
  height: number;
  format: 'avif' | 'webp' | 'png';
}
export interface StaticAsset {
  src: string;
  width: number | null;
  height: number | null;
  alt: string;
  variants: ImageVariant[];
}
export interface AssetMap {
  version: 1;
  assets: Record<string, StaticAsset>;
}
export interface AssetBuildOptions {
  supabaseUrl: string;
  outputDirectory: string;
  base: string;
  requiredIds: readonly string[];
  optionalIds?: readonly string[];
  timeoutMs?: number;
  fetch?: typeof fetch;
}
export function approvedAssetUrl(raw: string, configured: string): URL {
  const origin = new URL(configured);
  if (
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== '/' ||
    !(
      origin.protocol === 'https:' ||
      (origin.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(origin.hostname))
    )
  )
    throw new Error('Invalid configured Storage origin.');
  const url = new URL(raw);
  if (
    url.origin !== origin.origin ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.href !== raw
  )
    throw new Error('Unapproved media URL.');
  const match = /^\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/.exec(url.pathname);
  if (!match || match[1] === 'private' || !isMediaPath(match[1]!, match[2]!))
    throw new Error('Unapproved Storage location.');
  return url;
}
async function download(url: URL, options: AssetBuildOptions): Promise<Uint8Array> {
  const response = await (options.fetch ?? fetch)(url, {
    redirect: 'error',
    signal: AbortSignal.timeout(options.timeoutMs ?? 10000),
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!response.ok || !response.body) throw new Error('Required asset could not be downloaded.');
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > MAX_FILE_BYTES)) {
    await response.body.cancel();
    throw new Error('Asset exceeds download limit.');
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_FILE_BYTES) throw new Error('Asset exceeds download limit.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}
/** Writes only content-addressed files; the manifest changes only after every required asset succeeds. */
export async function buildAssets(
  input: readonly BuildAsset[],
  options: AssetBuildOptions,
): Promise<AssetMap> {
  if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(options.base)) throw new Error('Invalid artifact base.');
  const directory = resolve(options.outputDirectory, 'assets', 'media');
  await mkdir(directory, { recursive: true });
  const byId = new Map(input.map((asset) => [asset.id, asset]));
  if (
    input.some(
      (asset) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(asset.id),
    )
  )
    throw new Error('Invalid media identity.');
  if (byId.size !== input.length) throw new Error('Duplicate media identities.');
  const map: AssetMap = { version: 1, assets: {} };
  const required = new Set(options.requiredIds);
  const selected = new Set([...required, ...(options.optionalIds ?? [])]);
  const emit = async (bytes: Uint8Array, extension: string) => {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const name = hash + '.' + extension;
    const path = join(directory, name);
    let existing: Uint8Array | undefined;
    try {
      existing = await readFile(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (!existing || !Buffer.from(existing).equals(Buffer.from(bytes))) {
      const temporary = path + '.' + crypto.randomUUID() + '.tmp';
      await writeFile(temporary, bytes);
      await rename(temporary, path);
    }
    return options.base + 'assets/media/' + name;
  };
  for (const id of selected) {
    const asset = byId.get(id);
    // Optional means absent in the model; a selected but broken asset never silently disappears.
    if (!asset) {
      if (required.has(id)) throw new Error('Required media is missing from public snapshot.');
      continue;
    }
    if (asset.visibility !== 'public' || !asset.public_url)
      throw new Error('Private media cannot enter a static artifact.');
    const url = approvedAssetUrl(asset.public_url, options.supabaseUrl);
    const bytes = await download(url, options);
    if (bytes.length !== asset.file_size)
      throw new Error('Asset size differs from its registered metadata.');
    const valid = await validateBuildFile(
      new File([new Uint8Array(bytes)], asset.filename, { type: asset.mime_type }),
      {
        altText: asset.alt_text ?? '',
        decorative: asset.decorative,
        caption: '',
        category: asset.category as MediaCategory,
      },
    );
    if (valid.width !== asset.width || valid.height !== asset.height)
      throw new Error('Asset dimensions differ from metadata.');
    if (asset.mime_type === 'application/pdf') {
      map.assets[id] = {
        src: await emit(bytes, 'pdf'),
        width: null,
        height: null,
        alt: '',
        variants: [],
      };
      continue;
    }
    const widths = [
      ...new Set(
        [320, 640, 960, 1440].filter((w) => w < valid.width!).concat(Math.min(valid.width!, 1920)),
      ),
    ];
    const variants: ImageVariant[] = [];
    for (const width of widths)
      for (const format of ['avif', 'webp', 'png'] as const) {
        const image = sharp(bytes, { limitInputPixels: 40000000, failOn: 'warning' })
          .rotate()
          .resize({ width, withoutEnlargement: true });
        const output = await (
          format === 'avif'
            ? image.avif({ quality: 50, effort: 4 })
            : format === 'webp'
              ? image.webp({ quality: 80 })
              : image.png()
        ).toBuffer({ resolveWithObject: true });
        variants.push({
          src: await emit(output.data, format),
          width: output.info.width,
          height: output.info.height,
          format,
        });
      }
    const fallback = variants.filter((v) => v.format === 'png').at(-1)!;
    map.assets[id] = {
      src: fallback.src,
      width: fallback.width,
      height: fallback.height,
      alt: asset.alt_text ?? '',
      variants,
    };
  }
  const manifest = join(directory, 'manifest.json'),
    temporary = manifest + '.' + crypto.randomUUID() + '.tmp';
  await writeFile(temporary, JSON.stringify(map, null, 2) + '\n');
  await rename(temporary, manifest);
  return map;
}

export function resolveMedia(map: AssetMap, id: string): StaticAsset {
  const asset = map.assets[id];
  if (!asset) throw new Error('Required static asset missing.');
  return asset;
}

/** References and Markdown tokens are required; private/missing tokens fail closed. */
export async function buildSnapshotAssets(
  snapshot: PublicSnapshot,
  options: Omit<AssetBuildOptions, 'requiredIds' | 'optionalIds'>,
): Promise<AssetMap> {
  const ids = new Set(snapshot.media_references.map((reference) => reference.asset_id));
  const editorialRows = [
    ...snapshot.projects,
    ...snapshot.posts,
    ...(snapshot.settings ? [snapshot.settings] : []),
  ];
  for (const row of editorialRows)
    for (const value of Object.values(row)) {
      if (typeof value === 'string') for (const id of markdownAssetIds(value)) ids.add(id);
    }
  for (const document of snapshot.documents) ids.add(document.asset_id);
  return buildAssets(snapshot.media_assets, { ...options, requiredIds: [...ids] });
}
