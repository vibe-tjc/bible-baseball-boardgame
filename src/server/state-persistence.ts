import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import type { GameStateSnapshot } from '../shared/protocol.js';

export class StatePersistence {
  private sessionsDir: string;

  constructor(sessionsDir: string) {
    this.sessionsDir = sessionsDir;
    mkdirSync(sessionsDir, { recursive: true });
  }

  save(snapshot: GameStateSnapshot): void {
    const filePath = join(this.sessionsDir, `${snapshot.gameId}.json`);
    const data = {
      ...snapshot,
      savedAt: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(data, null, 2));
  }

  load(gameId: string): (GameStateSnapshot & { savedAt: string }) | null {
    const filePath = join(this.sessionsDir, `${gameId}.json`);
    if (!existsSync(filePath)) return null;
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  }

  remove(gameId: string): void {
    const filePath = join(this.sessionsDir, `${gameId}.json`);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  }

  listSaved(): Array<{ gameId: string; savedAt: string; teams: string[] }> {
    if (!existsSync(this.sessionsDir)) return [];
    return readdirSync(this.sessionsDir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const data = JSON.parse(readFileSync(join(this.sessionsDir, f), 'utf-8'));
        return {
          gameId: data.gameId,
          savedAt: data.savedAt,
          teams: data.teams?.map((t: { name: string }) => t.name) || [],
        };
      })
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }
}
