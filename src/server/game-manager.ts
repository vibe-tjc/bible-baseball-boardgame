import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { GameConfig } from '../shared/game-config.js';
import type { GameSessionEvents } from './game-session.js';
import { GameSession } from './game-session.js';
import { QuestionBank } from './question-bank.js';
import { StatePersistence } from './state-persistence.js';

export class GameManager {
  private games: Map<string, GameSession> = new Map();
  private persistence: StatePersistence;
  private questionsDir: string;

  constructor(sessionsDir: string, questionsDir: string) {
    this.persistence = new StatePersistence(sessionsDir);
    this.questionsDir = questionsDir;
  }

  private loadQuestionBank(): QuestionBank {
    const questionBank = new QuestionBank();
    try {
      const files = readdirSync(this.questionsDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        questionBank.loadFromFile(join(this.questionsDir, file));
      }
    } catch {
      // questionsDir may not exist yet
    }
    return questionBank;
  }

  createGame(config: GameConfig, events: GameSessionEvents): GameSession {
    const questionBank = this.loadQuestionBank();
    const session = new GameSession(undefined, config, questionBank, events);
    this.games.set(session.gameId, session);
    return session;
  }

  getGame(gameId: string): GameSession | undefined {
    return this.games.get(gameId);
  }

  removeGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      game.destroy();
      this.games.delete(gameId);
    }
  }

  listGames(): Array<{ gameId: string; state: string; players: number }> {
    return Array.from(this.games.values()).map(g => ({
      gameId: g.gameId,
      state: g.state,
      players: g.getTotalPlayers(),
    }));
  }

  saveGame(gameId: string): void {
    const game = this.games.get(gameId);
    if (game) {
      this.persistence.save(game.snapshot);
    }
  }

  saveAll(): void {
    for (const [id] of this.games) {
      this.saveGame(id);
    }
  }

  listSaved(): Array<{ gameId: string; savedAt: string; teams: string[] }> {
    return this.persistence.listSaved();
  }

  restoreGame(gameId: string, events: GameSessionEvents): GameSession | null {
    const snapshot = this.persistence.load(gameId);
    if (!snapshot) return null;

    const questionBank = this.loadQuestionBank();
    const session = GameSession.restore(snapshot, questionBank, events);
    this.games.set(session.gameId, session);
    return session;
  }
}
