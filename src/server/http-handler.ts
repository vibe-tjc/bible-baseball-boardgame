import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

export function createHttpHandler(publicDir: string) {
  const resolvedPublicDir = resolve(publicDir);

  return function handleRequest(req: IncomingMessage, res: ServerResponse) {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    let pathname = url.pathname;

    // Default to index or specific pages
    if (pathname === '/') pathname = '/host.html';

    // Prevent directory traversal
    const filePath = join(resolvedPublicDir, pathname);
    if (!filePath.startsWith(resolvedPublicDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    createReadStream(filePath).pipe(res);
  };
}
