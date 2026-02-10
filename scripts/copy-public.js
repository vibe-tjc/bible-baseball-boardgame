import { cpSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// Copy HTML files
cpSync(resolve(root, 'public/host.html'), resolve(root, 'dist/public/host.html'));
cpSync(resolve(root, 'public/player.html'), resolve(root, 'dist/public/player.html'));

// Copy styles
mkdirSync(resolve(root, 'dist/public/styles'), { recursive: true });
cpSync(resolve(root, 'public/styles'), resolve(root, 'dist/public/styles'), { recursive: true });

console.log('[copy-public] Static files copied to dist/public/');
