import { randomUUID } from 'node:crypto';
import type { GameConfig } from '../shared/game-config.js';
import type { GameState, PositiveOutcome, BaseballOutcome } from '../shared/game-constants.js';
import { HIT_ADVANCE, POSITIVE_OUTCOMES } from '../shared/game-constants.js';
import type {
  GameStateSnapshot,
  PlayerInfo,
  QuestionData,
  TeamState,
} from '../shared/protocol.js';
import { BuzzerArbiter } from './buzzer-arbiter.js';
import { QuestionBank } from './question-bank.js';

export interface GameSessionEvents {
  onStateChange: (session: GameSession) => void;
  onBuzzWinner: (session: GameSession, playerId: string) => void;
  onAnswerResult: (session: GameSession, result: AnswerResultData) => void;
  onPassToOther: (session: GameSession, teamIndex: number) => void;
  onGameOver: (session: GameSession) => void;
  onTimerTick: (session: GameSession, remaining: number) => void;
}

export interface AnswerResultData {
  correct: boolean;
  correctAnswerId: number;
  outcome: BaseballOutcome | null;
  teamIndex: number | null;
  teams: TeamState[];
}

export class GameSession {
  readonly gameId: string;
  private _state: GameState = 'lobby';
  config: GameConfig;
  private teams: TeamState[];
  private currentQuestion: QuestionData | null = null;
  private buzzWinnerId: string | null = null;
  private buzzWinnerTeamIndex: number | null = null;
  private totalQuestionsAsked = 0;
  private questionBank: QuestionBank;
  private buzzer: BuzzerArbiter;
  private events: GameSessionEvents;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private timerStartedAt = 0;
  private timerDuration = 0;
  private passAttempted = false;

  constructor(
    gameId: string | undefined,
    config: GameConfig,
    questionBank: QuestionBank,
    events: GameSessionEvents,
  ) {
    this.gameId = gameId || randomUUID();
    this.config = config;
    this.questionBank = questionBank;
    this.buzzer = new BuzzerArbiter();
    this.events = events;

    // Initialize teams
    this.teams = [];
    for (let i = 0; i < config.teamsCount; i++) {
      this.teams.push({
        index: i,
        name: `${String.fromCharCode(65 + i)}`, // Team A, B, C...
        runners: [false, false, false],
        score: 0,
        players: [],
      });
    }
  }

  get state(): GameState {
    return this._state;
  }

  get snapshot(): GameStateSnapshot {
    return {
      gameId: this.gameId,
      state: this._state,
      config: this.config,
      teams: this.teams.map(t => ({ ...t, runners: [...t.runners] as [boolean, boolean, boolean] })),
      currentQuestionIndex: this.totalQuestionsAsked,
      totalQuestionsAsked: this.totalQuestionsAsked,
      currentQuestion: this.currentQuestion,
      buzzWinnerId: this.buzzWinnerId,
      buzzWinnerTeamIndex: this.buzzWinnerTeamIndex,
    };
  }

  getTeams(): TeamState[] {
    return this.teams;
  }

  /** Add a player to the smallest team */
  addPlayer(id: string, name: string, isHost = false): PlayerInfo | null {
    if (this._state !== 'lobby') return null;

    // Find team with fewest players
    const sorted = [...this.teams].sort((a, b) => a.players.length - b.players.length);
    const team = sorted[0];

    if (team.players.length >= this.config.playersPerTeam) return null;

    const player: PlayerInfo = { id, name, teamIndex: team.index };
    if (isHost) player.isHost = true;
    team.players.push(player);
    return player;
  }

  removePlayer(id: string): void {
    for (const team of this.teams) {
      const idx = team.players.findIndex(p => p.id === id);
      if (idx >= 0) {
        team.players.splice(idx, 1);
        break;
      }
    }
  }

  getPlayer(id: string): PlayerInfo | undefined {
    for (const team of this.teams) {
      const p = team.players.find(p => p.id === id);
      if (p) return p;
    }
    return undefined;
  }

  getTotalPlayers(): number {
    return this.teams.reduce((sum, t) => sum + t.players.length, 0);
  }

  // ─── State Transitions ───

  /** Host starts the game */
  startGame(): boolean {
    if (this._state !== 'lobby') return false;
    if (this.getTotalPlayers() < 2) return false;
    this.nextQuestion();
    return true;
  }

  /** Advance to the next question */
  nextQuestion(): void {
    this.clearTimers();

    if (this.totalQuestionsAsked >= this.config.totalQuestions) {
      this.endGame();
      return;
    }

    const question = this.questionBank.getNext();
    if (!question) {
      this.endGame();
      return;
    }

    this.currentQuestion = question;
    this.totalQuestionsAsked++;
    this.passAttempted = false;
    this.buzzWinnerId = null;
    this.buzzWinnerTeamIndex = null;
    this._state = 'buzz_wait';

    // Open buzzer
    this.buzzer.open((winner) => {
      this.onBuzzLocked(winner.playerId);
    });

    // Start buzzer timer
    this.startTimer(this.config.buzzerTimeLimit, () => {
      this.onBuzzerTimeout();
    });

    this.events.onStateChange(this);
  }

  /** A player buzzes in */
  playerBuzz(playerId: string): boolean {
    if (this._state !== 'buzz_wait') return false;
    const result = this.buzzer.buzz(playerId);
    return result.accepted;
  }

  /** A player submits an answer */
  playerAnswer(playerId: string, answerId: number): void {
    if (this._state !== 'answering' && this._state !== 'pass_to_other') return;
    if (this._state === 'answering' && playerId !== this.buzzWinnerId) return;
    if (this._state === 'pass_to_other') {
      // Only the other team can answer
      const player = this.getPlayer(playerId);
      if (!player || player.teamIndex === this.buzzWinnerTeamIndex) return;
    }

    this.clearTimers();

    const correct = this.currentQuestion?.answers.some(
      a => a.id === answerId && a.correct
    ) ?? false;

    const correctAnswerId = this.currentQuestion?.answers.find(a => a.correct)?.id ?? 0;

    if (correct) {
      const player = this.getPlayer(playerId);
      const teamIndex = player?.teamIndex ?? 0;
      const outcome = this.rollOutcome();
      this.applyOutcome(teamIndex, outcome);

      this._state = 'result';
      this.events.onAnswerResult(this, {
        correct: true,
        correctAnswerId,
        outcome,
        teamIndex,
        teams: this.getTeams(),
      });
    } else if (this._state === 'answering' && !this.passAttempted) {
      // Wrong answer, pass to other team
      this.passAttempted = true;
      this._state = 'pass_to_other';
      const otherTeamIndex = this.buzzWinnerTeamIndex === 0 ? 1 : 0;

      this.startTimer(this.config.answerTimeLimit, () => {
        this.onAnswerTimeout();
      });

      this.events.onPassToOther(this, otherTeamIndex);
    } else {
      // Both wrong or pass_to_other wrong → strikeout
      this._state = 'result';
      this.events.onAnswerResult(this, {
        correct: false,
        correctAnswerId,
        outcome: 'strikeout',
        teamIndex: null,
        teams: this.getTeams(),
      });
    }
  }

  /** Host advances after seeing the result/animation */
  advance(): void {
    if (this._state !== 'result' && this._state !== 'animation') return;
    this.nextQuestion();
  }

  /** Set a live question from the host */
  setLiveQuestion(question: QuestionData): void {
    this.questionBank.addLiveQuestion(question);
  }

  // ─── Baseball Logic ───

  private rollOutcome(): PositiveOutcome {
    const probs = this.config.correctOutcomes;
    const rand = Math.random();
    let cumulative = 0;

    for (const outcome of POSITIVE_OUTCOMES) {
      cumulative += probs[outcome];
      if (rand < cumulative) return outcome;
    }

    return 'single'; // fallback
  }

  private applyOutcome(teamIndex: number, outcome: PositiveOutcome): void {
    const team = this.teams[teamIndex];
    const runners = team.runners;

    if (outcome === 'homerun') {
      // All runners + batter score
      let runs = 1; // batter
      for (let i = 0; i < 3; i++) {
        if (runners[i]) runs++;
        runners[i] = false;
      }
      team.score += runs;
    } else if (outcome === 'walk') {
      // Walk: forced advance only
      if (runners[0]) {
        if (runners[1]) {
          if (runners[2]) {
            // Bases loaded walk → runner on 3rd scores
            team.score += 1;
          }
          runners[2] = true;
        }
        runners[1] = true;
      }
      runners[0] = true;
    } else {
      const advance = HIT_ADVANCE[outcome]; // 1, 2, or 3
      let runs = 0;

      // Advance existing runners
      for (let i = 2; i >= 0; i--) {
        if (runners[i]) {
          const newBase = i + advance;
          runners[i] = false;
          if (newBase >= 3) {
            runs++; // runner scores
          } else {
            runners[newBase] = true;
          }
        }
      }

      // Place batter
      if (advance >= 4) {
        runs++; // batter scores (shouldn't happen for single/double/triple)
      } else {
        const batterBase = advance - 1;
        if (batterBase >= 0 && batterBase < 3) {
          runners[batterBase] = true;
        }
      }

      team.score += runs;
    }
  }

  // ─── Timer Management ───

  private startTimer(seconds: number, onExpire: () => void): void {
    this.clearTimers();
    this.timerStartedAt = Date.now();
    this.timerDuration = seconds * 1000;

    this.tickInterval = setInterval(() => {
      const elapsed = Date.now() - this.timerStartedAt;
      const remaining = Math.max(0, Math.ceil((this.timerDuration - elapsed) / 1000));
      this.events.onTimerTick(this, remaining);
    }, 100);

    this.timer = setTimeout(() => {
      this.clearTimers();
      onExpire();
    }, this.timerDuration);
  }

  private clearTimers(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }

  // ─── Internal Handlers ───

  private onBuzzLocked(playerId: string): void {
    const player = this.getPlayer(playerId);
    if (!player) return;

    this.buzzWinnerId = playerId;
    this.buzzWinnerTeamIndex = player.teamIndex;
    this._state = 'answering';

    // Start answer timer
    this.startTimer(this.config.answerTimeLimit, () => {
      this.onAnswerTimeout();
    });

    this.events.onBuzzWinner(this, playerId);
  }

  private onBuzzerTimeout(): void {
    this.buzzer.forceClose();
    this.clearTimers();

    // No one buzzed → strikeout (no benefit)
    this._state = 'result';
    const correctAnswerId = this.currentQuestion?.answers.find(a => a.correct)?.id ?? 0;
    this.events.onAnswerResult(this, {
      correct: false,
      correctAnswerId,
      outcome: 'strikeout',
      teamIndex: null,
      teams: this.getTeams(),
    });
  }

  private onAnswerTimeout(): void {
    this.clearTimers();

    if (this._state === 'answering' && !this.passAttempted) {
      // First team timed out, pass to other
      this.passAttempted = true;
      this._state = 'pass_to_other';
      const otherTeamIndex = this.buzzWinnerTeamIndex === 0 ? 1 : 0;

      this.startTimer(this.config.answerTimeLimit, () => {
        this.onAnswerTimeout();
      });

      this.events.onPassToOther(this, otherTeamIndex);
    } else {
      // Both timed out → strikeout
      this._state = 'result';
      const correctAnswerId = this.currentQuestion?.answers.find(a => a.correct)?.id ?? 0;
      this.events.onAnswerResult(this, {
        correct: false,
        correctAnswerId,
        outcome: 'strikeout',
        teamIndex: null,
        teams: this.getTeams(),
      });
    }
  }

  private endGame(): void {
    this.clearTimers();
    this._state = 'game_over';
    this.events.onGameOver(this);
  }

  /** Restore from a snapshot */
  static restore(
    snapshot: GameStateSnapshot,
    questionBank: QuestionBank,
    events: GameSessionEvents,
  ): GameSession {
    const session = new GameSession(snapshot.gameId, snapshot.config, questionBank, events);
    session._state = snapshot.state;
    session.totalQuestionsAsked = snapshot.totalQuestionsAsked;
    session.currentQuestion = snapshot.currentQuestion;
    session.buzzWinnerId = snapshot.buzzWinnerId;
    session.buzzWinnerTeamIndex = snapshot.buzzWinnerTeamIndex;
    // Restore teams
    for (let i = 0; i < snapshot.teams.length; i++) {
      if (session.teams[i]) {
        session.teams[i] = { ...snapshot.teams[i] };
      }
    }
    return session;
  }

  destroy(): void {
    this.clearTimers();
  }
}
