import type { BaseballOutcome } from '../../shared/game-constants.js';
import type { TeamState } from '../../shared/protocol.js';
import type { FieldPositions } from './baseball-field.js';

const TEAM_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RunnerAnim {
  color: string;
  teamName: string;
  path: Array<{ x: number; y: number }>;
  startT: number; // 0-1 when this runner starts moving
  endT: number;   // 0-1 when this runner finishes
  scored: boolean;
}

export interface AnimationPlayParams {
  outcome: BaseballOutcome;
  teamIndex: number | null;
  oldTeams: TeamState[];
  newTeams: TeamState[];
  positions: FieldPositions;
}

export class AnimationController {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private animating = false;
  private startTime = 0;
  private duration = 0;
  private onComplete: (() => void) | null = null;
  private particles: Particle[] = [];
  private outcome: BaseballOutcome = 'strikeout';
  private positions!: FieldPositions;
  private runners: RunnerAnim[] = [];
  private ballPath: Array<{ x: number; y: number; t: number }> = [];
  private outcomeText = '';
  private outcomeColor = '';
  private textScale = 0;
  private width = 0;
  private height = 0;
  private lang: 'zh' | 'en' = 'zh';

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  setLanguage(lang: 'zh' | 'en'): void {
    this.lang = lang;
  }

  /** Resize canvas to match container */
  resize(): void {
    const container = this.canvas.parentElement!;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    this.width = rect.width;
    this.height = rect.height;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  play(params: AnimationPlayParams, onComplete: () => void): void {
    this.onComplete = onComplete;
    this.startTime = performance.now();
    this.particles = [];
    this.textScale = 0;
    this.outcome = params.outcome;
    this.positions = params.positions;
    this.runners = [];
    this.ballPath = [];

    const labels: Record<string, { zh: string; en: string; color: string }> = {
      homerun: { zh: '全壘打！', en: 'HOME RUN!', color: '#f1c40f' },
      triple: { zh: '三壘安打！', en: 'TRIPLE!', color: '#e67e22' },
      double: { zh: '二壘安打！', en: 'DOUBLE!', color: '#3498db' },
      single: { zh: '一壘安打！', en: 'SINGLE!', color: '#2ecc71' },
      walk: { zh: '保送！', en: 'WALK!', color: '#95a5a6' },
      strikeout: { zh: '三振！', en: 'STRIKEOUT!', color: '#e74c3c' },
    };

    const info = labels[params.outcome] || { zh: params.outcome, en: params.outcome, color: '#fff' };
    this.outcomeText = this.lang === 'zh' ? info.zh : info.en;
    this.outcomeColor = info.color;

    const { home, first, second, third } = this.positions;
    const basePath = [home, first, second, third, home]; // full circuit
    const bd = this.positions.baseDistance;

    switch (params.outcome) {
      case 'homerun':
        this.duration = 3000;
        this.setupBallPath(home, { x: this.positions.center.x, y: second.y - bd * 1.5 }, 0.35);
        this.setupRunners(params, basePath, 4);
        break;
      case 'triple':
        this.duration = 2500;
        this.setupBallPath(home, { x: third.x - bd * 0.8, y: second.y - bd * 0.3 }, 0.3);
        this.setupRunners(params, basePath, 3);
        break;
      case 'double':
        this.duration = 2200;
        this.setupBallPath(home, { x: first.x + bd * 0.6, y: second.y + bd * 0.2 }, 0.3);
        this.setupRunners(params, basePath, 2);
        break;
      case 'single':
        this.duration = 1800;
        this.setupBallPath(home, { x: first.x + bd * 0.3, y: first.y - bd * 0.4 }, 0.3);
        this.setupRunners(params, basePath, 1);
        break;
      case 'walk':
        this.duration = 1500;
        this.setupWalkRunners(params, basePath);
        break;
      case 'strikeout':
        this.duration = 2000;
        break;
    }

    this.animating = true;
    this.tick(performance.now());
  }

  /** Build ball trajectory with parabolic arc */
  private setupBallPath(
    start: { x: number; y: number },
    end: { x: number; y: number },
    endT: number,
  ): void {
    const steps = 24;
    const bd = this.positions.baseDistance;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = start.x + (end.x - start.x) * t;
      const baseY = start.y + (end.y - start.y) * t;
      const arcHeight = -bd * 0.8 * Math.sin(Math.PI * t);
      this.ballPath.push({ x, y: baseY + arcHeight, t: t * endT });
    }
  }

  /** Build runner animations for hit outcomes */
  private setupRunners(
    params: AnimationPlayParams,
    basePath: Array<{ x: number; y: number }>,
    advance: number,
  ): void {
    if (params.teamIndex === null) return;
    const color = TEAM_COLORS[params.teamIndex % TEAM_COLORS.length];
    const teamName = params.newTeams[params.teamIndex]?.name || '';
    const oldRunners = params.oldTeams[params.teamIndex]?.runners || [false, false, false];

    // Animate existing runners (from farthest base first for visual clarity)
    for (let i = 2; i >= 0; i--) {
      if (oldRunners[i]) {
        const fromIdx = i + 1; // basePath index: 1=1st, 2=2nd, 3=3rd
        const toIdx = fromIdx + advance;
        const scored = toIdx >= 4;
        const clampedTo = Math.min(toIdx, 4);

        const path: Array<{ x: number; y: number }> = [];
        for (let j = fromIdx; j <= clampedTo; j++) {
          path.push(basePath[j % 5]);
        }

        this.runners.push({
          color,
          teamName,
          path,
          startT: 0.12 + (2 - i) * 0.04,
          endT: 0.12 + (2 - i) * 0.04 + 0.5,
          scored,
        });
      }
    }

    // Animate batter running from home
    const batterPath: Array<{ x: number; y: number }> = [];
    for (let j = 0; j <= Math.min(advance, 4); j++) {
      batterPath.push(basePath[j % 5]);
    }

    this.runners.push({
      color,
      teamName,
      path: batterPath,
      startT: 0.18,
      endT: 0.18 + 0.55,
      scored: advance >= 4,
    });
  }

  /** Build runner animations for walks (forced advance only) */
  private setupWalkRunners(
    params: AnimationPlayParams,
    basePath: Array<{ x: number; y: number }>,
  ): void {
    if (params.teamIndex === null) return;
    const color = TEAM_COLORS[params.teamIndex % TEAM_COLORS.length];
    const teamName = params.newTeams[params.teamIndex]?.name || '';
    const oldRunners = params.oldTeams[params.teamIndex]?.runners || [false, false, false];

    // Force advance chain (innermost first)
    if (oldRunners[0]) {
      if (oldRunners[1]) {
        if (oldRunners[2]) {
          // 3rd scores
          this.runners.push({
            color, teamName,
            path: [basePath[3], basePath[4]],
            startT: 0.1, endT: 0.6, scored: true,
          });
        }
        // 2nd → 3rd
        this.runners.push({
          color, teamName,
          path: [basePath[2], basePath[3]],
          startT: 0.15, endT: 0.65, scored: false,
        });
      }
      // 1st → 2nd
      this.runners.push({
        color, teamName,
        path: [basePath[1], basePath[2]],
        startT: 0.2, endT: 0.7, scored: false,
      });
    }

    // Batter walks to 1st (slower)
    this.runners.push({
      color, teamName,
      path: [basePath[0], basePath[1]],
      startT: 0.1, endT: 0.8, scored: false,
    });
  }

  // ─── Render Loop ───

  private tick = (now: number): void => {
    if (!this.animating) return;

    const elapsed = now - this.startTime;
    const progress = Math.min(elapsed / this.duration, 1);

    this.ctx.clearRect(0, 0, this.width, this.height);

    if (this.outcome === 'strikeout') {
      this.renderStrikeout(progress);
    } else {
      this.renderBall(progress);
      this.renderRunners(progress);
    }

    // Outcome text (appears after 35% progress)
    if (progress > 0.35) {
      const textProgress = Math.min((progress - 0.35) / 0.25, 1);
      this.textScale = easeOutBack(textProgress);
      this.renderOutcomeText();
    }

    // Home run fireworks
    if (this.outcome === 'homerun' && progress > 0.4) {
      this.spawnFireworks();
    }
    this.updateAndRenderParticles();

    if (progress >= 1) {
      this.animating = false;
      setTimeout(() => {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.onComplete?.();
      }, 600);
      return;
    }

    requestAnimationFrame(this.tick);
  };

  // ─── Ball Rendering ───

  private renderBall(progress: number): void {
    if (this.ballPath.length === 0) return;
    const ctx = this.ctx;
    const bd = this.positions.baseDistance;
    const ballR = Math.max(4, bd * 0.035);

    // Find current ball position
    let bp = this.ballPath[0];
    for (const p of this.ballPath) {
      if (p.t <= progress) bp = p;
      else break;
    }

    const lastT = this.ballPath[this.ballPath.length - 1]?.t || 0;
    if (progress > lastT + 0.1) return;

    // Ball trail
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = Math.max(1, ballR * 0.3);
    ctx.beginPath();
    let started = false;
    for (const p of this.ballPath) {
      if (p.t > progress) break;
      if (!started) { ctx.moveTo(p.x, p.y); started = true; }
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(bp.x, bp.y + ballR * 3, ballR, ballR * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(bp.x, bp.y, ballR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c0392b';
    ctx.lineWidth = Math.max(1, ballR * 0.25);
    ctx.stroke();
  }

  // ─── Runner Rendering ───

  private renderRunners(progress: number): void {
    const ctx = this.ctx;
    const bd = this.positions.baseDistance;
    const runnerR = Math.max(7, bd * 0.055);

    for (const runner of this.runners) {
      if (progress < runner.startT) continue;

      const runProgress = Math.min(
        (progress - runner.startT) / (runner.endT - runner.startT),
        1,
      );
      const easedProgress = easeInOutQuad(runProgress);

      const totalSegments = runner.path.length - 1;
      if (totalSegments <= 0) continue;

      const segFloat = easedProgress * totalSegments;
      const segIdx = Math.min(Math.floor(segFloat), totalSegments - 1);
      const segT = segFloat - segIdx;

      const p1 = runner.path[segIdx];
      const p2 = runner.path[segIdx + 1];
      const x = p1.x + (p2.x - p1.x) * segT;
      const y = p1.y + (p2.y - p1.y) * segT;

      // Scoring flash effect
      if (runner.scored && runProgress >= 0.92) {
        const flashT = (runProgress - 0.92) / 0.08;
        ctx.fillStyle = runner.color;
        ctx.globalAlpha = 0.6 * (1 - flashT);
        ctx.beginPath();
        ctx.arc(
          this.positions.home.x,
          this.positions.home.y,
          runnerR * (2 + flashT * 4),
          0,
          Math.PI * 2,
        );
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      // Runner dot
      ctx.fillStyle = runner.color;
      ctx.beginPath();
      ctx.arc(x, y - runnerR * 0.5, runnerR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = Math.max(1.5, runnerR * 0.15);
      ctx.stroke();

      // Team letter
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${runnerR * 1.1}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(runner.teamName, x, y - runnerR * 0.5 + 1);
    }
  }

  // ─── Strikeout Rendering ───

  private renderStrikeout(progress: number): void {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const cy = this.height / 2;
    const bd = this.positions.baseDistance;

    // Phase 1: Bat swing (0-0.3)
    if (progress < 0.35) {
      const swingT = progress / 0.35;
      const angle = -Math.PI / 3 + (Math.PI * 2) / 3 * easeInOutQuad(swingT);
      const batLen = bd * 0.6;
      const batX = this.positions.home.x;
      const batY = this.positions.home.y - bd * 0.1;

      ctx.save();
      ctx.translate(batX, batY);
      ctx.rotate(angle);

      // Bat handle
      const handleW = Math.max(3, bd * 0.025);
      ctx.fillStyle = '#8B6914';
      ctx.fillRect(-handleW / 2, -batLen, handleW, batLen);

      // Bat barrel
      const barrelW = Math.max(6, bd * 0.05);
      const barrelH = Math.max(10, bd * 0.1);
      ctx.fillStyle = '#A0782C';
      ctx.fillRect(-barrelW / 2, -batLen - barrelH, barrelW, barrelH);

      ctx.restore();

      // Swing arc trail
      if (swingT > 0.3) {
        ctx.strokeStyle = `rgba(255,255,255,${0.4 * (1 - swingT)})`;
        ctx.lineWidth = Math.max(2, bd * 0.02);
        ctx.beginPath();
        ctx.arc(batX, batY, batLen * 0.8, -Math.PI / 3, angle, false);
        ctx.stroke();
      }
    }

    // Whoosh lines (0.1-0.5)
    if (progress > 0.1 && progress < 0.5) {
      const missT = (progress - 0.1) / 0.4;
      ctx.save();
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - missT)})`;
      ctx.lineWidth = Math.max(2, bd * 0.015);
      for (let i = 0; i < 3; i++) {
        const spread = bd * 0.3 * (i + 1);
        const startAngle = -Math.PI * 0.2 + i * 0.1;
        ctx.beginPath();
        ctx.arc(
          this.positions.home.x,
          this.positions.home.y - bd * 0.1,
          spread,
          startAngle,
          startAngle + Math.PI * 0.4,
        );
        ctx.stroke();
      }
      ctx.restore();
    }

    // Phase 2: Big K appears (0.25-1.0)
    if (progress > 0.25) {
      const kT = Math.min((progress - 0.25) / 0.3, 1);
      const kSize = Math.min(bd * 1.5, this.height * 0.35) * easeOutElastic(kT);

      ctx.save();
      ctx.font = `900 ${kSize}px "Arial Black", Arial`;
      ctx.fillStyle = this.outcomeColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = Math.min(kT * 3, 1);
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = bd * 0.1;
      ctx.shadowOffsetX = bd * 0.02;
      ctx.shadowOffsetY = bd * 0.02;
      ctx.fillText('K', cx, cy);
      ctx.restore();
    }
  }

  // ─── Outcome Text ───

  private renderOutcomeText(): void {
    const ctx = this.ctx;
    const cx = this.width / 2;
    const bd = this.positions.baseDistance;
    const fontSize = Math.min(bd * 0.4, this.width * 0.06, 56) * this.textScale;
    const cy = this.positions.second.y - bd * 0.8;

    ctx.save();
    ctx.font = `900 ${fontSize}px "Arial Black", Arial`;
    ctx.fillStyle = this.outcomeColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = fontSize * 0.15;
    ctx.fillText(this.outcomeText, cx, cy);
    ctx.restore();
  }

  // ─── Particles ───

  private spawnFireworks(): void {
    if (Math.random() > 0.25) return;
    const colors = ['#f1c40f', '#e74c3c', '#3498db', '#2ecc71', '#9b59b6', '#fff', '#ff6b6b'];
    const bd = this.positions.baseDistance;
    const cx = this.width / 2 + (Math.random() - 0.5) * bd * 2;
    const cy = this.positions.second.y - bd * (0.5 + Math.random() * 1.5);

    for (let i = 0; i < 8; i++) {
      const angle = ((Math.PI * 2) / 8) * i + Math.random() * 0.3;
      const speed = 2 + Math.random() * 4;
      this.particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40 + Math.random() * 40,
        maxLife: 80,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateAndRenderParticles(): void {
    const ctx = this.ctx;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.08;
      p.vx *= 0.99;
      p.life--;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.globalAlpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  get isAnimating(): boolean {
    return this.animating;
  }
}

// ─── Easing Functions ───

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function easeOutElastic(t: number): number {
  if (t === 0 || t === 1) return t;
  const c4 = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
