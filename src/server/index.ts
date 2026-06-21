import { createServer } from 'node:http';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHttpHandler } from './http-handler.js';
import { GameManager } from './game-manager.js';
import { WsHandler } from './ws-handler.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || '3000', 10);
// Public base URL for the player join link / QR code (e.g.
// https://game.example.com). Set this when running behind a reverse proxy.
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || undefined;

// Resolve paths
const publicDir = resolve(__dirname, '..', 'public');
const dataDir = resolve(__dirname, '..', '..', 'data');
const sessionsDir = resolve(dataDir, 'sessions');
const questionsDir = resolve(dataDir, 'questions');

// Create server
const httpHandler = createHttpHandler(publicDir);
const server = createServer(httpHandler);

// Create game manager & WS handler
const gameManager = new GameManager(sessionsDir, questionsDir);
const wsHandler = new WsHandler(server, gameManager, PORT, PUBLIC_BASE_URL);

// Graceful shutdown
function shutdown() {
  console.log('\n[Bible Home Run] Shutting down, saving all games...');
  gameManager.saveAll();
  server.close();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(PORT, () => {
  console.log(`[Bible Home Run] Server running at http://localhost:${PORT}`);
  console.log(`[Bible Home Run] Host: http://localhost:${PORT}/host.html`);
});
