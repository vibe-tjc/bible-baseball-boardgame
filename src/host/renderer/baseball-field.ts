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
    const { home, first, second, third, center, baseDistance: bd } = this.positions;

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

    // Large tan diamond (infield)
    const tanRadius = bd * 1.18;
    ctx.fillStyle = '#b45309';
    this.roundedDiamondPath(center.x, center.y, tanRadius, bd * 0.18);
    ctx.fill();

    // White basepath outline connecting the bases
    ctx.strokeStyle = '#fff7ed';
    ctx.lineWidth = Math.max(6, bd * 0.06);
    ctx.lineJoin = 'round';
    this.roundedDiamondPath(center.x, center.y, bd, bd * 0.12);
    ctx.stroke();

    // Pitcher's mound
    const moundR = Math.max(14, bd * 0.42);
    ctx.fillStyle = '#d97706';
    ctx.beginPath();
    ctx.arc(center.x, center.y, moundR, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff7ed';
    ctx.beginPath();
    ctx.arc(center.x, center.y, moundR * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Bases (chunky rounded squares)
    const baseSize = Math.max(14, bd * 0.3);
    this.drawBase(first.x, first.y, baseSize);
    this.drawBase(second.x, second.y, baseSize);
    this.drawBase(third.x, third.y, baseSize);

    // Home plate (pentagon, point down)
    this.drawHomePlate(home.x, home.y, baseSize * 0.6);

    // Base labels
    const labelFont = `bold ${Math.max(9, Math.round(bd * 0.14))}px Arial`;
    const labelOpts = { font: labelFont, bg: 'rgba(255,255,255,0.85)', fg: '#334155', padX: Math.max(5, bd * 0.05), padY: Math.max(2, bd * 0.02) };
    const labelGap = baseSize * 0.85;
    this.drawPill(home.x, home.y + labelGap, 'HOME', labelOpts);
    this.drawPill(second.x, second.y - labelGap, '2B', labelOpts);
    this.drawPill(first.x + labelGap, first.y, '1B', labelOpts);
    this.drawPill(third.x - labelGap, third.y, '3B', labelOpts);

    // "BASEBALL BOARD" pill near the top of the field
    const boardFont = `bold ${Math.max(9, Math.round(bd * 0.13))}px Arial`;
    const boardY = Math.max(bd * 0.4, center.y - tanRadius - bd * 0.35);
    this.drawPill(center.x, boardY, 'BASEBALL BOARD', {
      font: boardFont, bg: 'rgba(6,78,59,0.7)', fg: '#d1fae5',
      padX: Math.max(10, bd * 0.12), padY: Math.max(4, bd * 0.04), letterSpacing: Math.max(2, bd * 0.03),
    });
  }

  /** Draw a rounded pill with centered text. */
  private drawPill(
    cx: number, cy: number, text: string,
    opts: { font: string; bg: string; fg: string; padX: number; padY: number; letterSpacing?: number },
  ): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.font = opts.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const spacing = opts.letterSpacing ?? 0;
    const baseW = ctx.measureText(text).width;
    const textW = baseW + spacing * Math.max(0, text.length - 1);
    const w = textW + opts.padX * 2;
    const fontPx = parseInt((opts.font.match(/(\d+)px/) || [])[1] || '12', 10);
    const h = fontPx + opts.padY * 2;
    ctx.fillStyle = opts.bg;
    this.roundedRectPath(cx - w / 2, cy - h / 2, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = opts.fg;
    if (spacing > 0) {
      // manual letter spacing
      let x = cx - textW / 2;
      ctx.textAlign = 'left';
      for (const ch of text) {
        const cw = ctx.measureText(ch).width;
        ctx.fillText(ch, x, cy);
        x += cw + spacing;
      }
    } else {
      ctx.fillText(text, cx, cy);
    }
    ctx.restore();
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
    const w = size; // half-width
    ctx.fillStyle = '#fff7ed';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = Math.max(2, size * 0.08);
    ctx.beginPath();
    ctx.moveTo(x - w, y - size);       // top-left
    ctx.lineTo(x + w, y - size);       // top-right
    ctx.lineTo(x + w, y);              // mid-right
    ctx.lineTo(x, y + size);           // bottom point
    ctx.lineTo(x - w, y);              // mid-left
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  private drawBase(x: number, y: number, size: number): void {
    const ctx = this.ctx;
    const r = size * 0.22;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#fff7ed';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = Math.max(2, size * 0.08);
    this.roundedRectPath(-size / 2, -size / 2, size, size, r);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** Trace a rounded rectangle path. */
  private roundedRectPath(x: number, y: number, w: number, h: number, r: number): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
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
