import { defineConfig } from 'tsdown';
import { cpSync, mkdirSync } from 'node:fs';

export default defineConfig([
  {
    entry: ['src/server/index.ts'],
    format: 'esm',
    platform: 'node',
    target: 'node22',
    outDir: 'dist/server',
    external: ['ws', 'qrcode'],
    clean: true,
  },
  {
    entry: {
      'host': 'src/host/index.ts',
    },
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist/public/js',
    globalName: 'BibleBaseballHost',
  },
  {
    entry: {
      'player': 'src/player/index.ts',
    },
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    outDir: 'dist/public/js',
    globalName: 'BibleBaseballPlayer',
  },
]);
