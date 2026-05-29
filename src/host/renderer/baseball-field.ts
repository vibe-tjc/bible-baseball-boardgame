import type { TeamState } from '../../shared/protocol.js';

/** Positions for bases and key field locations */
export interface FieldPositions {
  home: { x: number; y: number };
  first: { x: number; y: number };
  second: { x: number; y: number };
  third: { x: number; y: number };
  pitcher: { x: number; y: number };
  center: { x: number; y: number };
  baseDistance: number;
}

const TEAM_COLORS = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];

export class BaseballFieldRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 0;
  private height = 0;
  private positions!: FieldPositions;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  get fieldPositions(): FieldPositions {
    return this.positions;
  }

  /** Resize canvas to fit container, recalculate positions */
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
    this.calculatePositions();
  }

  private calculatePositions(): void {
    const cx = this.width / 2;
    const cy = this.height * 0.58;
    const bd = Math.min(this.width, this.height) * 0.22;

    this.positions = {
      home: { x: cx, y: cy + bd },
      first: { x: cx + bd, y: cy },
      second: { x: cx, y: cy - bd },
      third: { x: cx - bd, y: cy },
      pitcher: { x: cx, y: cy + bd * 0.1 },
      center: { x: cx, y: cy },
      baseDistance: bd,
    };
  }

  /** Draw the static baseball field background */
  drawField(): void {
    const ctx = this.ctx;
    const { home, first, second, third, pitcher, center, baseDistance: bd } = this.positions;

    ctx.clearRect(0, 0, this.width, this.height);

    // Vertical green gradient background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, this.height);
    bgGrad.addColorStop(0, '#047857');
    bgGrad.addColorStop(1, '#064e3b');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Vertical mowing pinstripes
    const bandW = Math.max(16, bd * 0.18);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let x = 0; x < this.width; x += bandW * 2) {
      ctx.fillRect(x, 0, bandW, this.height);
    }

    // Infield dirt area (expanded diamond)
    const dirtExpand = bd * 0.25;
    ctx.fillStyle = '#c4956a';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y + dirtExpand * 0.3);
    ctx.lineTo(first.x + dirtExpand, first.y);
    ctx.lineTo(second.x, second.y - dirtExpand);
    ctx.lineTo(third.x - dirtExpand, third.y);
    ctx.closePath();
    ctx.fill();

    // Infield grass (rounded diamond inside dirt)
    const innerScale = 0.6;
    const icx = center.x;
    const icy = center.y;
    ctx.fillStyle = '#35a045';
    ctx.beginPath();
    ctx.moveTo(icx, icy + bd * innerScale);
    ctx.quadraticCurveTo(icx + bd * innerScale * 0.6, icy + bd * innerScale * 0.6, icx + bd * innerScale, icy);
    ctx.quadraticCurveTo(icx + bd * innerScale * 0.6, icy - bd * innerScale * 0.6, icx, icy - bd * innerScale);
    ctx.quadraticCurveTo(icx - bd * innerScale * 0.6, icy - bd * innerScale * 0.6, icx - bd * innerScale, icy);
    ctx.quadraticCurveTo(icx - bd * innerScale * 0.6, icy + bd * innerScale * 0.6, icx, icy + bd * innerScale);
    ctx.closePath();
    ctx.fill();

    // Base paths (dirt strips)
    const pathWidth = Math.max(6, bd * 0.05);
    ctx.strokeStyle = '#c4956a';
    ctx.lineWidth = pathWidth;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(first.x, first.y);
    ctx.lineTo(second.x, second.y);
    ctx.lineTo(third.x, third.y);
    ctx.lineTo(home.x, home.y);
    ctx.stroke();

    // Base lines (white)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = Math.max(2, bd * 0.015);
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(first.x, first.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(third.x, third.y);
    ctx.stroke();

    // Foul lines extending to outfield
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = Math.max(1, bd * 0.01);
    ctx.setLineDash([bd * 0.03, bd * 0.03]);
    const foulExtend = bd * 1.5;
    const dx1 = first.x - home.x;
    const dy1 = first.y - home.y;
    const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    ctx.lineTo(first.x + (dx1 / len1) * foulExtend, first.y + (dy1 / len1) * foulExtend);
    ctx.stroke();
    const dx3 = third.x - home.x;
    const dy3 = third.y - home.y;
    const len3 = Math.sqrt(dx3 * dx3 + dy3 * dy3);
    ctx.beginPath();
    ctx.moveTo(third.x, third.y);
    ctx.lineTo(third.x + (dx3 / len3) * foulExtend, third.y + (dy3 / len3) * foulExtend);
    ctx.stroke();
    ctx.setLineDash([]);

    // Pitcher's mound
    const moundR = Math.max(10, bd * 0.08);
    ctx.fillStyle = '#c4956a';
    ctx.beginPath();
    ctx.arc(pitcher.x, pitcher.y, moundR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    const rubberW = Math.max(8, bd * 0.06);
    ctx.fillRect(pitcher.x - rubberW / 2, pitcher.y - 1, rubberW, 2);

    // Home plate (pentagon)
    this.drawHomePlate(home.x, home.y, Math.max(8, bd * 0.06));

    // Bases (rotated squares)
    const baseSize = Math.max(8, bd * 0.06);
    this.drawBase(first.x, first.y, baseSize);
    this.drawBase(second.x, second.y, baseSize);
    this.drawBase(third.x, third.y, baseSize);

    // Batter's boxes
    this.drawBatterBox(home.x, home.y, bd);
  }

  /** Trace a rounded-corner diamond path centered at (cx,cy) with axis radius `radius`. */
  private roundedDiamondPath(cx: number, cy: number, radius: number, r: number): void {
    const ctx = this.ctx;
    // Diamond points: top, right, bottom, left
    const pts = [
      { x: cx, y: cy - radius },
      { x: cx + radius, y: cy },
      { x: cx, y: cy + radius },
      { x: cx - radius, y: cy },
    ];
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const prev = pts[(i + 3) % 4];
      const curr = pts[i];
      const next = pts[(i + 1) % 4];
      // approach point along edge from prev->curr
      const a = this.pointTowards(curr, prev, r);
      // depart point along edge curr->next
      const b = this.pointTowards(curr, next, r);
      if (i === 0) ctx.moveTo(a.x, a.y);
      else ctx.lineTo(a.x, a.y);
      ctx.quadraticCurveTo(curr.x, curr.y, b.x, b.y);
    }
    ctx.closePath();
  }

  /** Point `dist` away from `from` toward `to`. */
  private pointTowards(from: { x: number; y: number }, to: { x: number; y: number }, dist: number): { x: number; y: number } {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    return { x: from.x + (dx / len) * dist, y: from.y + (dy / len) * dist };
  }

  private drawHomePlate(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(x, y + size);
    ctx.lineTo(x + size * 0.8, y + size * 0.3);
    ctx.lineTo(x + size * 0.8, y - size * 0.5);
    ctx.lineTo(x - size * 0.8, y - size * 0.5);
    ctx.lineTo(x - size * 0.8, y + size * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawBase(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.strokeStyle = '#999';
    ctx.lineWidth = 1;
    ctx.strokeRect(-size / 2, -size / 2, size, size);
    ctx.restore();
  }

  private drawBatterBox(hx: number, hy: number, bd: number): void {
    const ctx = this.ctx;
    const boxW = Math.max(12, bd * 0.09);
    const boxH = Math.max(20, bd * 0.15);
    const offset = Math.max(10, bd * 0.08);

    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(1, bd * 0.01);
    ctx.strokeRect(hx - offset - boxW, hy - boxH / 2, boxW, boxH);
    ctx.strokeRect(hx + offset, hy - boxH / 2, boxW, boxH);
  }

  /** Draw runners for a single team with an offset to avoid overlap */
  drawRunners(team: TeamState, color: string, offset: number): void {
    const ctx = this.ctx;
    const bases = [this.positions.first, this.positions.second, this.positions.third];
    const bd = this.positions.baseDistance;
    const runnerR = Math.max(8, bd * 0.06);

    for (let i = 0; i < 3; i++) {
      if (team.runners[i]) {
        const base = bases[i];
        const ox = offset * runnerR * 0.8;
        const oy = -runnerR * 1.8;

        // Runner body (colored circle)
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(base.x + ox, base.y + oy, runnerR, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = Math.max(1.5, bd * 0.012);
        ctx.stroke();

        // Team letter
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${runnerR * 1.2}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(team.name, base.x + ox, base.y + oy + 1);
      }
    }
  }

  /** Draw all teams' runners side by side */
  drawAllRunners(teams: TeamState[]): void {
    for (let i = 0; i < teams.length; i++) {
      const offset = i === 0 ? -1 : 1;
      this.drawRunners(teams[i], TEAM_COLORS[i % TEAM_COLORS.length], offset);
    }
  }
}
