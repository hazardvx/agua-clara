import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 4173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

const CSP = [
  "default-src 'self'",
  "connect-src 'self' https://*.supabase.co",
  "img-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "script-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

http.createServer((req, res) => {
  const requested = decodeURIComponent((req.url || '/').split('?')[0]);
  const relative = requested === '/' ? '/index.html' : requested;
  const file = path.normalize(path.join(root, relative));

  // Prevenir directory traversal
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end('Prohibido');
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      // SPA fallback solo para rutas sin extensión (navegación).
      // Un archivo con extensión que no existe debe devolver 404, no HTML.
      const isNavigation = relative !== '/index.html' && path.extname(relative) === '';
      if (isNavigation) {
        fs.readFile(path.join(root, 'index.html'), (err2, fallback) => {
          if (err2) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            return res.end('No encontrado');
          }
          res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Content-Security-Policy': CSP,
          });
          res.end(fallback);
        });
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('No encontrado');
    }

    const ext = path.extname(file);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const isVolatile = ext === '.html' || ext === '.js';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Security-Policy': CSP,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(self)',
      'Cache-Control': isVolatile ? 'no-cache' : 'public, max-age=3600',
    });
    res.end(data);
  });
}).listen(port, () => {
  console.log(`\n  Agua Clara disponible en http://localhost:${port}\n`);
});
