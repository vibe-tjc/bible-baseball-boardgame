export interface BuzzerEntry {
  playerId: string;
  serverTimestamp: number;
}

export interface BuzzerResult {
  accepted: boolean;
  position?: number;
  reason?: string;
}

export class BuzzerArbiter {
  private queue: BuzzerEntry[] = [];
  private locked = false;
  private graceWindowMs: number;
  private graceTimer: ReturnType<typeof setTimeout> | null = null;
  private onLock: ((winner: BuzzerEntry) => void) | null = null;

  constructor(graceWindowMs = 50) {
    this.graceWindowMs = graceWindowMs;
  }

  /** Open the buzzer for a new round */
  open(onLock: (winner: BuzzerEntry) => void): void {
    this.queue = [];
    this.locked = false;
    this.onLock = onLock;
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
  }

  /** Record a buzz attempt */
  buzz(playerId: string): BuzzerResult {
    if (this.locked) {
      return { accepted: false, reason: 'locked' };
    }

    // Prevent double-buzz
    if (this.queue.some(e => e.playerId === playerId)) {
      return { accepted: false, reason: 'already_buzzed' };
    }

    const entry: BuzzerEntry = {
      playerId,
      serverTimestamp: Date.now(),
    };

    this.queue.push(entry);

    // First buzz starts the grace window
    if (this.queue.length === 1) {
      this.graceTimer = setTimeout(() => this.lock(), this.graceWindowMs);
    }

    return { accepted: true, position: this.queue.length };
  }

  /** Force lock (e.g. on timeout) */
  forceClose(): void {
    if (this.graceTimer) {
      clearTimeout(this.graceTimer);
      this.graceTimer = null;
    }
    this.locked = true;
  }

  private lock(): void {
    this.locked = true;
    this.graceTimer = null;
    // Sort by server timestamp
    this.queue.sort((a, b) => a.serverTimestamp - b.serverTimestamp);
    if (this.queue.length > 0 && this.onLock) {
      this.onLock(this.queue[0]);
    }
  }

  get winner(): BuzzerEntry | null {
    if (!this.locked || this.queue.length === 0) return null;
    return this.queue[0];
  }

  get isLocked(): boolean {
    return this.locked;
  }
}
