import type { GameConfig, OutcomeProbabilities } from './game-config.js';
import type { BaseballOutcome, GameState, PositiveOutcome } from './game-constants.js';

/** Base message envelope */
export interface WsMessage<T extends string = string, P = unknown> {
  type: T;
  payload: P;
  timestamp: number;
}

// ─── Question Types ───

export interface QuestionAnswer {
  id: number;
  text: { zh: string; en: string };
  correct: boolean;
}

export interface QuestionData {
  id: string;
  text: { zh: string; en: string };
  answers: QuestionAnswer[];
  category?: string;
}

// ─── Player / Team Info ───

export interface PlayerInfo {
  id: string;
  name: string;
  teamIndex: number;
  isHost?: boolean;
}

export interface TeamState {
  index: number;
  name: string;
  runners: [boolean, boolean, boolean]; // 1st, 2nd, 3rd
  score: number;
  players: PlayerInfo[];
}

// ─── Full Game Snapshot (for state sync / persistence) ───

export interface GameStateSnapshot {
  gameId: string;
  state: GameState;
  config: GameConfig;
  teams: TeamState[];
  currentQuestionIndex: number;
  totalQuestionsAsked: number;
  currentQuestion: QuestionData | null;
  buzzWinnerId: string | null;
  buzzWinnerTeamIndex: number | null;
}

// ─── Host → Server Messages ───

export type HostCreateMsg = WsMessage<'host:create', { config: GameConfig }>;
export type HostStartMsg = WsMessage<'host:start', {}>;
export type HostNextMsg = WsMessage<'host:next', {}>;
export type HostAdvanceMsg = WsMessage<'host:advance', {}>;
export type HostPauseMsg = WsMessage<'host:pause', {}>;
export type HostLiveQuestionMsg = WsMessage<'host:liveQuestion', { question: QuestionData }>;
export type HostUpdateConfigMsg = WsMessage<'host:updateConfig', { config: Partial<GameConfig> }>;
export type HostSaveConfigMsg = WsMessage<'host:saveConfig', {}>;
export type HostResetConfigMsg = WsMessage<'host:resetConfig', {}>;
export type HostResumeGameMsg = WsMessage<'host:resumeGame', { gameId: string }>;
export type HostRejoinMsg = WsMessage<'host:rejoin', { gameId: string }>;
export type HostJoinAsPlayerMsg = WsMessage<'host:joinAsPlayer', { name: string }>;
export type HostLeaveAsPlayerMsg = WsMessage<'host:leaveAsPlayer', {}>;

export type HostMessage =
  | HostCreateMsg
  | HostStartMsg
  | HostNextMsg
  | HostAdvanceMsg
  | HostPauseMsg
  | HostLiveQuestionMsg
  | HostUpdateConfigMsg
  | HostSaveConfigMsg
  | HostResetConfigMsg
  | HostResumeGameMsg
  | HostRejoinMsg
  | HostJoinAsPlayerMsg
  | HostLeaveAsPlayerMsg;

// ─── Player → Server Messages ───

export type PlayerJoinMsg = WsMessage<'player:join', { name: string; gameId: string }>;
export type PlayerBuzzMsg = WsMessage<'player:buzz', { clientTimestamp: number }>;
export type PlayerAnswerMsg = WsMessage<'player:answer', { answerId: number }>;

export type PlayerMessage =
  | PlayerJoinMsg
  | PlayerBuzzMsg
  | PlayerAnswerMsg;

// ─── Server → Host Messages ───

export type ServerGameCreatedMsg = WsMessage<'server:gameCreated', {
  gameId: string;
  joinUrl: string;
  qrDataUrl: string;
}>;

export type ServerPlayerJoinedMsg = WsMessage<'server:playerJoined', {
  player: PlayerInfo;
  teams: TeamState[];
}>;

export type ServerQuestionMsg = WsMessage<'server:question', {
  question: QuestionData;
  questionNumber: number;
  totalQuestions: number;
  timeLimit: number;
}>;

export type ServerBuzzWinnerMsg = WsMessage<'server:buzzWinner', {
  playerId: string;
  playerName: string;
  teamIndex: number;
}>;

export type ServerAnswerResultMsg = WsMessage<'server:answerResult', {
  correct: boolean;
  correctAnswerId: number;
  outcome: BaseballOutcome | null;
  teamIndex: number | null;
  teams: TeamState[];
}>;

export type ServerPassToOtherMsg = WsMessage<'server:passToOther', {
  teamIndex: number;
  timeLimit: number;
}>;

export type ServerStateSyncMsg = WsMessage<'server:stateSync', {
  snapshot: GameStateSnapshot;
}>;

export type ServerGameOverMsg = WsMessage<'server:gameOver', {
  teams: TeamState[];
  winnerTeamIndex: number | null;
}>;

export type ServerTimerTickMsg = WsMessage<'server:timerTick', {
  remaining: number;
}>;

export type ServerErrorMsg = WsMessage<'server:error', {
  message: string;
}>;

export type ServerSavedGamesMsg = WsMessage<'server:savedGames', {
  games: Array<{ gameId: string; savedAt: string; teams: string[] }>;
}>;

export type ServerHostJoinedMsg = WsMessage<'server:hostJoined', {
  player: PlayerInfo | null;
}>;

export type ServerMessage =
  | ServerGameCreatedMsg
  | ServerPlayerJoinedMsg
  | ServerQuestionMsg
  | ServerBuzzWinnerMsg
  | ServerAnswerResultMsg
  | ServerPassToOtherMsg
  | ServerStateSyncMsg
  | ServerGameOverMsg
  | ServerTimerTickMsg
  | ServerErrorMsg
  | ServerSavedGamesMsg
  | ServerHostJoinedMsg;

// ─── Server → Player Messages ───

export type ServerBuzzerOpenMsg = WsMessage<'server:buzzerOpen', {
  questionText: { zh: string; en: string };
  timeLimit: number;
}>;

export type ServerBuzzerLockedMsg = WsMessage<'server:buzzerLocked', {
  winnerId: string;
  winnerName: string;
}>;

export type ServerYourTurnMsg = WsMessage<'server:yourTurn', {
  answers: Array<{ id: number; text: { zh: string; en: string } }>;
  timeLimit: number;
}>;

export type ServerWaitMsg = WsMessage<'server:wait', {
  message: string;
}>;

export type ServerPlayerMessage =
  | ServerBuzzerOpenMsg
  | ServerBuzzerLockedMsg
  | ServerYourTurnMsg
  | ServerWaitMsg
  | ServerAnswerResultMsg
  | ServerGameOverMsg
  | ServerTimerTickMsg;

// ─── Utility ───

export function createMessage<T extends string, P>(type: T, payload: P): WsMessage<T, P> {
  return { type, payload, timestamp: Date.now() };
}
