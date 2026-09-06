import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { createUrlHelpers } from '../src/lib/utils/urls.ts';

/** Serve F8-generated files during Astro dev; production emits them directly into outDir. */
export function homeAssetsIntegration() {
  let directory, prefix;
  return {
    name: 'public-home-assets',
    hooks: {
      'astro:config:done': ({ config }) => {
        directory = fileURLToPath(config.outDir);
        prefix = createUrlHelpers(new URL(config.base, 'http://localhost/').href).withBase(
          '/assets/media/',
        );
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use(async (request, response, next) => {
          const pathname = new URL(request.url, 'http://localhost/').pathname;
          if (!pathname.startsWith(prefix)) return next();
          const filename = pathname.slice(prefix.length);
          if (!/^[a-f0-9]{64}\.(?:png|avif|webp|pdf)$/.test(filename)) return next();
          const path = join(directory, 'assets', 'media', filename);
          try {
            await access(path);
          } catch {
            return next();
          }
          const types = {
            png: 'image/png',
            webp: 'image/webp',
            avif: 'image/avif',
            pdf: 'application/pdf',
          };
          response.setHeader('Content-Type', types[filename.split('.').at(-1)]);
          response.setHeader('Cache-Control', 'no-cache');
          const stream = createReadStream(path);
          stream.on('error', () => response.destroy());
          stream.pipe(response);
        });
      },
    },
  };
}
