import { networkInterfaces } from 'node:os';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import QRCode from 'qrcode';
import type { GameConfig } from '../shared/game-config.js';
import { DEFAULT_CONFIG } from '../shared/game-config.js';
import {
  createMessage,
  type PlayerInfo,
  type QuestionData,
  type WsMessage,
} from '../shared/protocol.js';
import { GameManager } from './game-manager.js';
import type { GameSession, AnswerResultData, GameSessionEvents } from './game-session.js';

interface ClientConnection {
  ws: WebSocket;
  role: 'host' | 'player';
  gameId: string | null;
  playerId: string | null;
}

export class WsHandler {
  private wss: WebSocketServer;
  private gameManager: GameManager;
  private clients: Map<WebSocket, ClientConnection> = new Map();
  private port: number;

  constructor(server: HttpServer, gameManager: GameManager, port: number) {
    this.gameManager = gameManager;
    this.port = port;
    this.wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });

    this.wss.on('connection', (ws) => {
      const conn: ClientConnection = {
        ws,
        role: 'host',
        gameId: null,
        playerId: null,
      };
      this.clients.set(ws, conn);

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString()) as WsMessage;
          this.handleMessage(ws, conn, msg);
        } catch (e) {
          this.send(ws, createMessage('server:error', { message: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        const conn = this.clients.get(ws);
        if (conn?.playerId && conn.gameId) {
          const game = this.gameManager.getGame(conn.gameId);
          if (game) {
            game.removePlayer(conn.playerId);
          }
        }
        this.clients.delete(ws);
      });
    });
  }

  private handleMessage(ws: WebSocket, conn: ClientConnection, msg: WsMessage): void {
    switch (msg.type) {
      case 'host:create':
        this.handleHostCreate(ws, conn, msg.payload as { config: GameConfig });
        break;
      case 'host:start':
        this.handleHostStart(conn);
        break;
      case 'host:next':
      case 'host:advance':
        this.handleHostAdvance(conn);
        break;
      case 'host:liveQuestion':
        this.handleHostLiveQuestion(conn, msg.payload as { question: QuestionData });
        break;
      case 'host:updateConfig':
        this.handleHostUpdateConfig(conn, msg.payload as { config: Partial<GameConfig> });
        break;
      case 'host:rejoin':
        this.handleHostRejoin(ws, conn, msg.payload as { gameId: string });
        break;
      case 'host:joinAsPlayer':
        this.handleHostJoinAsPlayer(ws, conn, msg.payload as { name: string });
        break;
      case 'host:leaveAsPlayer':
        this.handleHostLeaveAsPlayer(ws, conn);
        break;
      case 'player:join':
        this.handlePlayerJoin(ws, conn, msg.payload as { name: string; gameId: string });
        break;
      case 'player:buzz':
        this.handlePlayerBuzz(conn);
        break;
      case 'player:answer':
        this.handlePlayerAnswer(conn, msg.payload as { answerId: number });
        break;
      default:
        this.send(ws, createMessage('server:error', { message: `Unknown message type: ${msg.type}` }));
    }
  }

  private async handleHostCreate(
    ws: WebSocket,
    conn: ClientConnection,
    payload: { config: GameConfig },
  ): Promise<void> {
    const config = { ...DEFAULT_CONFIG, ...payload.config };
    const events = this.createGameEvents();
    const session = this.gameManager.createGame(config, events);

    conn.role = 'host';
    conn.gameId = session.gameId;

    const localIp = getLocalIp();
    const joinUrl = `http://${localIp}:${this.port}/player.html?game=${session.gameId}`;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
    } catch {
      // fallback
    }

    this.send(ws, createMessage('server:gameCreated', {
      gameId: session.gameId,
      joinUrl,
      qrDataUrl,
    }));

    // Also send list of saved games
    const savedGames = this.gameManager.listSaved();
    this.send(ws, createMessage('server:savedGames', { games: savedGames }));
  }

  private async handleHostRejoin(
    ws: WebSocket,
    conn: ClientConnection,
    payload: { gameId: string },
  ): Promise<void> {
    const game = this.gameManager.getGame(payload.gameId);
    if (!game) {
      // Game no longer exists, create a new one
      await this.handleHostCreate(ws, conn, { config: { ...DEFAULT_CONFIG } });
      return;
    }

    conn.role = 'host';
    conn.gameId = payload.gameId;

    const localIp = getLocalIp();
    const joinUrl = `http://${localIp}:${this.port}/player.html?game=${payload.gameId}`;

    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(joinUrl, { width: 300, margin: 2 });
    } catch {
      // fallback
    }

    this.send(ws, createMessage('server:gameCreated', {
      gameId: payload.gameId,
      joinUrl,
      qrDataUrl,
    }));

    // Restore team display on host
    const teams = game.getTeams();
    const allPlayers = teams.flatMap(t => t.players);
    if (allPlayers.length > 0) {
      this.send(ws, createMessage('server:playerJoined', {
        player: allPlayers[allPlayers.length - 1],
        teams,
      }));
    }
  }

  private handleHostStart(conn: ClientConnection): void {
    if (!conn.gameId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    game.startGame();
  }

  private handleHostAdvance(conn: ClientConnection): void {
    if (!conn.gameId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    game.advance();
  }

  private handleHostLiveQuestion(
    conn: ClientConnection,
    payload: { question: QuestionData },
  ): void {
    if (!conn.gameId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    game.setLiveQuestion(payload.question);
  }

  private handleHostUpdateConfig(
    conn: ClientConnection,
    payload: { config: Partial<GameConfig> },
  ): void {
    if (!conn.gameId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    Object.assign(game.config, payload.config);
  }

  private handleHostJoinAsPlayer(
    ws: WebSocket,
    conn: ClientConnection,
    payload: { name: string },
  ): void {
    if (!conn.gameId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;

    // Already participating: ignore
    if (conn.playerId) {
      this.send(ws, createMessage('server:hostJoined', { player: game.getPlayer(conn.playerId) ?? null }));
      return;
    }

    const playerId = crypto.randomUUID();
    const player = game.addPlayer(playerId, payload.name, true);
    if (!player) {
      // Game full or already started
      this.send(ws, createMessage('server:hostJoined', { player: null }));
      return;
    }

    // Host connection now doubles as a player; role stays 'host'.
    conn.playerId = playerId;

    this.send(ws, createMessage('server:hostJoined', { player }));

    // Update team display on host
    this.broadcastToHost(conn.gameId, createMessage('server:playerJoined', {
      player,
      teams: game.getTeams(),
    }));
  }

  private handleHostLeaveAsPlayer(ws: WebSocket, conn: ClientConnection): void {
    if (!conn.gameId || !conn.playerId) {
      this.send(ws, createMessage('server:hostJoined', { player: null }));
      return;
    }
    const game = this.gameManager.getGame(conn.gameId);
    if (game) {
      game.removePlayer(conn.playerId);
    }
    conn.playerId = null;

    this.send(ws, createMessage('server:hostJoined', { player: null }));

    if (game) {
      this.broadcastToHost(conn.gameId, createMessage('server:playerJoined', {
        player: { id: '', name: '', teamIndex: 0 },
        teams: game.getTeams(),
      }));
    }
  }

  private handlePlayerJoin(
    ws: WebSocket,
    conn: ClientConnection,
    payload: { name: string; gameId: string },
  ): void {
    const game = this.gameManager.getGame(payload.gameId);
    if (!game) {
      this.send(ws, createMessage('server:error', { message: 'Game not found' }));
      return;
    }

    const playerId = crypto.randomUUID();
    const player = game.addPlayer(playerId, payload.name);
    if (!player) {
      this.send(ws, createMessage('server:error', { message: 'Game is full or already started' }));
      return;
    }

    conn.role = 'player';
    conn.gameId = payload.gameId;
    conn.playerId = playerId;

    // Notify the joining player
    this.send(ws, createMessage('server:stateSync', { snapshot: game.snapshot }));

    // Notify host
    this.broadcastToHost(payload.gameId, createMessage('server:playerJoined', {
      player,
      teams: game.getTeams(),
    }));
  }

  private handlePlayerBuzz(conn: ClientConnection): void {
    if (!conn.gameId || !conn.playerId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    game.playerBuzz(conn.playerId);
  }

  private handlePlayerAnswer(
    conn: ClientConnection,
    payload: { answerId: number },
  ): void {
    if (!conn.gameId || !conn.playerId) return;
    const game = this.gameManager.getGame(conn.gameId);
    if (!game) return;
    game.playerAnswer(conn.playerId, payload.answerId);
  }

  // ─── Game Event Handlers ───

  private createGameEvents(): GameSessionEvents {
    return {
      onStateChange: (session) => {
        const snapshot = session.snapshot;
        // Send question to all clients in this game
        if (snapshot.state === 'buzz_wait' && snapshot.currentQuestion) {
          // Send full question to host
          this.broadcastToHost(session.gameId, createMessage('server:question', {
            question: snapshot.currentQuestion,
            questionNumber: snapshot.totalQuestionsAsked,
            totalQuestions: session.config.totalQuestions,
            timeLimit: session.config.buzzerTimeLimit,
          }));

          // Send question text (no answers) + buzzer open to players
          this.broadcastToPlayers(session.gameId, createMessage('server:buzzerOpen', {
            questionText: snapshot.currentQuestion.text,
            timeLimit: session.config.buzzerTimeLimit,
          }));
        }

        // Auto-save on state change
        this.gameManager.saveGame(session.gameId);
      },

      onBuzzWinner: (session, playerId) => {
        const player = session.getPlayer(playerId);
        if (!player) return;

        // Notify host
        this.broadcastToHost(session.gameId, createMessage('server:buzzWinner', {
          playerId,
          playerName: player.name,
          teamIndex: player.teamIndex,
        }));

        // Notify winner: your turn to answer
        this.sendToPlayer(session.gameId, playerId, createMessage('server:yourTurn', {
          answers: session.snapshot.currentQuestion?.answers.map(a => ({
            id: a.id,
            text: a.text,
          })) || [],
          timeLimit: session.config.answerTimeLimit,
        }));

        // Notify others: buzzer locked
        this.broadcastToPlayers(session.gameId, createMessage('server:buzzerLocked', {
          winnerId: playerId,
          winnerName: player.name,
        }), playerId);
      },

      onAnswerResult: (session, result) => {
        const msg = createMessage('server:answerResult', {
          correct: result.correct,
          correctAnswerId: result.correctAnswerId,
          outcome: result.outcome,
          teamIndex: result.teamIndex,
          teams: result.teams,
        });

        // Broadcast to all
        this.broadcastToGame(session.gameId, msg);

        // Auto-save
        this.gameManager.saveGame(session.gameId);
      },

      onPassToOther: (session, teamIndex) => {
        // Notify host
        this.broadcastToHost(session.gameId, createMessage('server:passToOther', {
          teamIndex,
          timeLimit: session.config.answerTimeLimit,
        }));

        // Notify players on the other team: your turn
        this.broadcastToTeamPlayers(session.gameId, teamIndex, createMessage('server:yourTurn', {
          answers: session.snapshot.currentQuestion?.answers.map(a => ({
            id: a.id,
            text: a.text,
          })) || [],
          timeLimit: session.config.answerTimeLimit,
        }));

        // Notify other players: wait
        this.broadcastToPlayers(session.gameId, createMessage('server:wait', {
          message: 'Passed to other team',
        }), undefined, teamIndex);
      },

      onGameOver: (session) => {
        const teams = session.getTeams();
        const maxScore = Math.max(...teams.map(t => t.score));
        const winners = teams.filter(t => t.score === maxScore);
        const winnerTeamIndex = winners.length === 1 ? winners[0].index : null;

        this.broadcastToGame(session.gameId, createMessage('server:gameOver', {
          teams,
          winnerTeamIndex,
        }));

        this.gameManager.saveGame(session.gameId);
      },

      onTimerTick: (session, remaining) => {
        this.broadcastToGame(session.gameId, createMessage('server:timerTick', {
          remaining,
        }));
      },
    };
  }

  // ─── Broadcast Helpers ───

  private send(ws: WebSocket, msg: WsMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    }
  }

  private broadcastToGame(gameId: string, msg: WsMessage): void {
    for (const [ws, conn] of this.clients) {
      if (conn.gameId === gameId) {
        this.send(ws, msg);
      }
    }
  }

  private broadcastToHost(gameId: string, msg: WsMessage): void {
    for (const [ws, conn] of this.clients) {
      if (conn.gameId === gameId && conn.role === 'host') {
        this.send(ws, msg);
      }
    }
  }

  private broadcastToPlayers(
    gameId: string,
    msg: WsMessage,
    excludePlayerId?: string,
    excludeTeamIndex?: number,
  ): void {
    for (const [ws, conn] of this.clients) {
      if (conn.gameId === gameId && conn.role === 'player') {
        if (excludePlayerId && conn.playerId === excludePlayerId) continue;
        if (excludeTeamIndex !== undefined) {
          const game = this.gameManager.getGame(gameId);
          const player = game?.getPlayer(conn.playerId!);
          if (player && player.teamIndex === excludeTeamIndex) continue;
        }
        this.send(ws, msg);
      }
    }
  }

  private broadcastToTeamPlayers(
    gameId: string,
    teamIndex: number,
    msg: WsMessage,
  ): void {
    const game = this.gameManager.getGame(gameId);
    if (!game) return;
    for (const [ws, conn] of this.clients) {
      if (conn.gameId === gameId && conn.role === 'player' && conn.playerId) {
        const player = game.getPlayer(conn.playerId);
        if (player && player.teamIndex === teamIndex) {
          this.send(ws, msg);
        }
      }
    }
  }

  private sendToPlayer(gameId: string, playerId: string, msg: WsMessage): void {
    for (const [ws, conn] of this.clients) {
      if (conn.gameId === gameId && conn.playerId === playerId) {
        this.send(ws, msg);
        break;
      }
    }
  }
}

function getLocalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]!) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}
