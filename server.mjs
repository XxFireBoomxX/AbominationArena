import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('.', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const publicFiles = new Set(['index.html', 'styles.css', 'src/game.js', 'src/engine.js', 'src/world.js', 'src/weapons.js']);
const port = Number(process.env.PORT || 3000);
http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!publicFiles.has(file)) {
      response.writeHead(404);
      return response.end('Not found');
    }
    const content = await readFile(path.join(root, file));
    response.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    response.end(content);
  } catch {
    response.writeHead(400);
    response.end('Bad request');
  }
}).listen(port, '0.0.0.0', () => console.log(`Abomination Arena running on port ${port}`));
