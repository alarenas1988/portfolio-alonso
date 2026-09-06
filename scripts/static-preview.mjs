import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
const types = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};
/** Read-only loopback server for checking an already generated artifact, with Pages-style 404. */
export async function staticPreview(directory, base) {
  const root = resolve(directory);
  const server = createServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname;
      if (!pathname.startsWith(base) || !['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(404).end();
        return;
      }
      let file = resolve(root, decodeURIComponent(pathname.slice(base.length)) || 'index.html');
      if (relative(root, file).startsWith('..')) {
        response.writeHead(403).end();
        return;
      }
      if ((await stat(file)).isDirectory()) file = resolve(file, 'index.html');
      response
        .writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' })
        .end(await readFile(file));
    } catch {
      response
        .writeHead(404, { 'content-type': 'text/html' })
        .end(await readFile(resolve(root, '404.html')));
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    url: `http://127.0.0.1:${server.address().port}${base}`,
    close: () =>
      new Promise((done) => {
        server.close(done);
        server.closeAllConnections();
      }),
  };
}
