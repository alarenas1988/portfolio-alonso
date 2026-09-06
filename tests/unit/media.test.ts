import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { validateBuildFile } from '../../src/lib/media/validation-build.ts';
import { MAX_FILE_BYTES } from '../../src/lib/media/validation.ts';
import { mediaPath, isMediaPath } from '../../src/lib/media/paths.ts';
import { buildAssets, approvedAssetUrl, resolveMedia } from '../../src/lib/media/build-assets.ts';
import type { BuildAsset } from '../../src/lib/media/build-assets.ts';
import { markdownAssetIds } from '../../src/lib/media/usage.ts';

const metadata = {
  altText: 'Diagrama de prueba',
  decorative: false,
  caption: '',
  category: 'general' as const,
};
const origin = 'https://fixture.supabase.co';
const path = 'general/10000000-0000-4000-8000-000000000001.png';
const url = origin + '/storage/v1/object/public/portfolio-public/' + path;
const png = await sharp({ create: { width: 32, height: 24, channels: 4, background: '#22d3ee' } })
  .png()
  .toBuffer();
const file = new File([png], 'diseño (versión 1).png', { type: 'image/png' });
const source: BuildAsset = {
  id: '10000000-0000-4000-8000-000000000001',
  public_url: url,
  visibility: 'public',
  filename: file.name,
  mime_type: file.type,
  file_size: file.size,
  width: 32,
  height: 24,
  alt_text: metadata.altText,
  decorative: false,
  category: 'general',
};
const validFetch: typeof fetch = async () => new Response(png);
for (const [format, mime] of [
  ['jpeg', 'image/jpeg'],
  ['png', 'image/png'],
  ['webp', 'image/webp'],
  ['avif', 'image/avif'],
] as const) {
  test('decodes valid ' + format, async () => {
    const bytes = await sharp(png).toFormat(format).toBuffer();
    const result = await validateBuildFile(
      new File([new Uint8Array(bytes)], 'prueba.' + format, { type: mime }),
      metadata,
    );
    assert.equal(result.width, 32);
    assert.equal(result.height, 24);
  });
}
for (const [label, bytes, name, mime] of [
  ['corrupt PNG', png.subarray(0, 20), 'broken.png', 'image/png'],
  ['false MIME', png, 'fake.jpg', 'image/jpeg'],
  ['wrong extension', png, 'wrong.webp', 'image/png'],
  [
    'HTML disguised as PNG',
    Buffer.from('<html><script>attack()</script></html>'),
    'fake.png',
    'image/png',
  ],
  ['SVG upload', Buffer.from('<svg></svg>'), 'icon.svg', 'image/svg+xml'],
  ['oversized', Buffer.alloc(MAX_FILE_BYTES + 1), 'huge.png', 'image/png'],
  ['unknown type', Buffer.from('MZ'), 'file.exe', 'application/octet-stream'],
  ['path in filename', png, '../file.png', 'image/png'],
] as const)
  test('rejects ' + label, async () => {
    await assert.rejects(
      validateBuildFile(new File([new Uint8Array(bytes)], name, { type: mime }), metadata),
    );
  });
test('alt is required unless explicitly decorative', async () => {
  await assert.rejects(validateBuildFile(file, { ...metadata, altText: '' }));
  assert.equal(
    (await validateBuildFile(file, { ...metadata, altText: '', decorative: true })).width,
    32,
  );
  await assert.rejects(validateBuildFile(file, { ...metadata, decorative: true }));
});
test('Unicode and repeated filenames never determine immutable paths', async () => {
  assert.equal((await validateBuildFile(file, metadata)).filename, file.name);
  const first = mediaPath('private', 'temporary', 'png'),
    second = mediaPath('private', 'temporary', 'png');
  assert.notEqual(first, second);
  assert.ok(isMediaPath('private', first));
  assert.throws(() => mediaPath('blog', 'general', 'png'));
  assert.throws(() => mediaPath('portfolio-public', 'general', 'pdf'));
});
test('parses real PDF and rejects corrupt or active PDF', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  const bytes = await pdf.save();
  assert.equal(
    (
      await validateBuildFile(
        new File([new Uint8Array(bytes)], 'cv.pdf', { type: 'application/pdf' }),
        metadata,
      )
    ).width,
    null,
  );
  await assert.rejects(
    validateBuildFile(
      new File([new Uint8Array(bytes.subarray(0, 40))], 'cv.pdf', { type: 'application/pdf' }),
      metadata,
    ),
  );
  pdf.catalog.set(PDFName.of('OpenAction'), PDFString.of('attack'));
  await assert.rejects(
    validateBuildFile(
      new File([new Uint8Array(await pdf.save())], 'cv.pdf', { type: 'application/pdf' }),
      metadata,
    ),
  );
});
test('Markdown usage deduplicates repeated asset tokens', () => {
  assert.deepEqual(
    markdownAssetIds('![alt](media:' + source.id + ') [PDF](media:' + source.id + ')'),
    [source.id],
  );
});
test('build emits responsive formats, local URLs, stable hashes and preserves manifest on failure', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-media-build-'));
  const options = {
    supabaseUrl: origin,
    base: '/portfolio-alonso/',
    outputDirectory,
    requiredIds: [source.id],
    fetch: validFetch,
  };
  const map = await buildAssets([source], options),
    asset = resolveMedia(map, source.id);
  assert.deepEqual(
    asset.variants.map((v) => v.format),
    ['avif', 'webp', 'png'],
  );
  assert.ok(asset.src.startsWith('/portfolio-alonso/assets/media/'));
  const filename = asset.src.split('/').at(-1)!;
  const timestamp = (await stat(join(outputDirectory, 'assets/media', filename))).mtimeMs;
  assert.deepEqual(await buildAssets([source], options), map);
  assert.equal((await stat(join(outputDirectory, 'assets/media', filename))).mtimeMs, timestamp);
  const manifest = await readFile(join(outputDirectory, 'assets/media/manifest.json'), 'utf8');
  assert.ok(!manifest.includes('supabase'));
  assert.ok(!manifest.includes('token'));
  await assert.rejects(
    buildAssets([source], {
      ...options,
      fetch: async () => new Response('missing', { status: 404 }),
    }),
  );
  assert.equal(
    await readFile(join(outputDirectory, 'assets/media/manifest.json'), 'utf8'),
    manifest,
  );
});
for (const [label, input, transport] of [
  ['missing', [], validFetch],
  ['private', [{ ...source, visibility: 'private' }], validFetch],
  ['corrupt', [source], async () => new Response(Buffer.alloc(png.length))],
  [
    'oversized header',
    [source],
    async () => new Response('x', { headers: { 'content-length': String(MAX_FILE_BYTES + 1) } }),
  ],
  ['oversized stream', [source], async () => new Response(Buffer.alloc(MAX_FILE_BYTES + 1))],
  [
    'wrong origin',
    [{ ...source, public_url: url.replace('fixture.supabase.co', 'evil.example') }],
    validFetch,
  ],
  ['signed URL', [{ ...source, public_url: url + '?token=SECRET_CANARY' }], validFetch],
] as const)
  test('build rejects ' + label, async () => {
    const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-media-negative-'));
    await assert.rejects(
      buildAssets(input, {
        supabaseUrl: origin,
        base: '/',
        outputDirectory,
        requiredIds: [source.id],
        fetch: transport,
      }),
    );
  });
test('downloads use redirect denial, bounded timeout and no credentials', async () => {
  const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-media-timeout-'));
  await assert.rejects(
    buildAssets([source], {
      supabaseUrl: origin,
      base: '/',
      outputDirectory,
      requiredIds: [source.id],
      timeoutMs: 5,
      fetch: async (_url, options) => {
        assert.equal(options?.redirect, 'error');
        assert.equal(options?.credentials, 'omit');
        await new Promise((_resolve, reject) => {
          options?.signal?.addEventListener('abort', () => reject(new Error('timeout')));
          setTimeout(() => reject(new Error('test deadline')), 20);
        });
        throw new Error('unreachable');
      },
    }),
  );
});
test('URL guard rejects foreign hosts, private paths, credentials, traversal and schemes', () => {
  for (const raw of [
    'http://169.254.169.254/latest/meta-data',
    url.replace('/public/', '/sign/'),
    url.replace('https://', 'https://user:pass@'),
    url + '#fragment',
    url.replace('/general/', '/general/../general/'),
    'file:///etc/passwd',
  ])
    assert.throws(() => approvedAssetUrl(raw, origin));
});
test('build copies CV PDF into the same artifact and supports optional absent resources', async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const bytes = await pdf.save();
  const asset = {
    ...source,
    mime_type: 'application/pdf',
    filename: 'CV.pdf',
    file_size: bytes.length,
    width: null,
    height: null,
    public_url:
      origin + '/storage/v1/object/public/documents/cv/10000000-0000-4000-8000-000000000001.pdf',
  };
  const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-cv-build-'));
  const map = await buildAssets([asset], {
    supabaseUrl: origin,
    base: '/',
    outputDirectory,
    requiredIds: [asset.id],
    optionalIds: ['absent'],
    fetch: async () => new Response(new Uint8Array(bytes)),
  });
  assert.ok(resolveMedia(map, asset.id).src.endsWith('.pdf'));
  assert.equal(Object.keys(map.assets).length, 1);
});

test('large images generate responsive widths without upscaling and invalid identities fail', async () => {
  const bytes = await sharp({
    create: { width: 800, height: 600, channels: 3, background: '#335577' },
  })
    .png()
    .toBuffer();
  const asset = { ...source, width: 800, height: 600, file_size: bytes.length };
  const outputDirectory = await mkdtemp(join(tmpdir(), 'portfolio-responsive-media-'));
  const options = {
    supabaseUrl: origin,
    base: '/',
    outputDirectory,
    requiredIds: [source.id],
    fetch: (async () => new Response(bytes)) as typeof fetch,
  };
  const result = resolveMedia(await buildAssets([asset], options), source.id);
  assert.deepEqual(
    result.variants.filter((variant) => variant.format === 'webp').map((variant) => variant.width),
    [320, 640, 800],
  );
  assert.ok(
    result.variants.every(
      (variant) => variant.width <= 800 && variant.height === variant.width * 0.75,
    ),
  );
  await assert.rejects(buildAssets([{ ...asset, id: '__proto__' }], options));
});

test('PDF validation traverses nested actions rather than only root keys', async () => {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  page.node.set(
    PDFName.of('Annots'),
    pdf.context.obj([{ Type: 'Annot', Subtype: 'Link', A: { S: 'Launch', F: 'unsafe.exe' } }]),
  );
  await assert.rejects(
    validateBuildFile(
      new File([new Uint8Array(await pdf.save())], 'nested.pdf', { type: 'application/pdf' }),
      metadata,
    ),
  );
});
