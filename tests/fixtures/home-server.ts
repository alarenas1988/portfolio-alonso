import { createServer } from 'node:http';
import { once } from 'node:events';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { emptyHomeSnapshot, ids } from './home-snapshot.ts';
import { publicPagesSnapshot } from './public-pages-snapshot.ts';

export type HomeFixtureMode = 'full' | 'empty' | 'unavailable' | 'incompatible' | 'missing-asset';
export const fixtureKey = 'sb_publishable_offline_home_fixture';

/** Loopback only. Synthetic bytes and DTOs never reach a Supabase project. */
export async function startHomeFixtureServer(mode: HomeFixtureMode = 'full') {
  const image = async (accent: string, chart: boolean) =>
    sharp(
      Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600">
      <rect width="960" height="600" fill="#080c16"/>
      <rect x="48" y="44" width="864" height="512" rx="18" fill="#101827" stroke="#25324a"/>
      <circle cx="76" cy="70" r="5" fill="${accent}"/>
      <path d="M96 70H220M72 106H888" stroke="#34435b" stroke-width="3"/>
      <rect x="72" y="132" width="160" height="400" rx="8" fill="#0b1120"/>
      <path d="M92 158H198M92 190H174M92 222H190" stroke="#34435b" stroke-width="7"/>
      ${chart ? '<path d="M288 446L380 354L458 384L550 264L632 310L726 208L846 178" fill="none" stroke="' + accent + '" stroke-width="5"/><path d="M288 460H850M288 390H850M288 320H850M288 250H850" stroke="#25324a"/>' : '<path d="M340 270H714M526 270V418" fill="none" stroke="' + accent + '" stroke-width="3"/><rect x="274" y="224" width="150" height="90" rx="12" fill="#112a32" stroke="' + accent + '"/><rect x="452" y="370" width="150" height="90" rx="12" fill="#182038" stroke="#837bea"/><rect x="662" y="224" width="150" height="90" rx="12" fill="#112a32" stroke="' + accent + '"/>'}
    </svg>`),
    )
      .png()
      .toBuffer();
  const pdf = await PDFDocument.create();
  pdf.addPage([240, 160]).drawText('Synthetic test document', { x: 20, y: 90, size: 12 });
  const files = new Map([
    [ids.image, await image('#22d3ee', false)],
    [ids.secondImage, await image('#9b8afb', true)],
    [ids.pdf, Buffer.from(await pdf.save())],
  ]);
  const requests = { snapshot: 0, assets: 0, rejected: 0 };
  let origin = '';
  const server = createServer((request, response) => {
    const path = request.url;
    if (request.method === 'POST' && path === '/rest/v1/rpc/get_public_snapshot') {
      if (request.headers.apikey !== fixtureKey || request.headers.authorization) {
        requests.rejected++;
        response.writeHead(403).end();
        return;
      }
      requests.snapshot++;
      response.setHeader('content-type', 'application/json');
      if (mode === 'unavailable') {
        response.writeHead(503).end(JSON.stringify({ message: 'Fixture unavailable' }));
        return;
      }
      const snapshot = mode === 'empty' ? emptyHomeSnapshot() : publicPagesSnapshot(origin);
      for (const asset of snapshot.media_assets) asset.file_size = files.get(asset.id)!.length;
      response.end(JSON.stringify(mode === 'incompatible' ? { schema_version: 999 } : snapshot));
      return;
    }
    if (request.method === 'GET' && path?.startsWith('/storage/v1/object/public/')) {
      const id = path.split('/').at(-1)?.split('.')[0] ?? '';
      const bytes = files.get(id);
      if (!bytes || mode === 'missing-asset') {
        response.writeHead(404).end();
        return;
      }
      requests.assets++;
      response
        .writeHead(200, {
          'content-type': id === ids.pdf ? 'application/pdf' : 'image/png',
          'content-length': bytes.length,
        })
        .end(bytes);
      return;
    }
    requests.rejected++;
    response.writeHead(404).end();
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Fixture did not bind to loopback.');
  origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    requests,
    env: {
      PUBLIC_SITE_URL: 'https://example.com/portfolio-alonso/',
      PUBLIC_SUPABASE_URL: origin,
      PUBLIC_SUPABASE_PUBLISHABLE_KEY: fixtureKey,
      ASTRO_TELEMETRY_DISABLED: '1',
      ASTRO_PREVIEW_BACKGROUND: '0',
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
}
