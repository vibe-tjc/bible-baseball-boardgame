# Flat Modern Baseball Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the host baseball field to the flat modern reference design (green pinstripes, large tan diamond, white basepath outline, amber mound, chunky labeled bases, "BASEBALL BOARD" pill) without changing field positions or animations.

**Architecture:** Rewrite `BaseballFieldRenderer.drawField()` and its draw helpers in `src/host/renderer/baseball-field.ts`. `calculatePositions()`, the `FieldPositions` interface, `resize()`, `drawRunners()`, and `drawAllRunners()` stay byte-for-byte unchanged so `animations.ts` and multi-team runners keep working. Plus a small CSS background tweak in `public/styles/host.css`.

**Tech Stack:** TypeScript, HTML5 Canvas 2D API, tsdown build.

**Testing note:** No test framework exists in this repo and canvas output is visual. Each task's gate is `npm run build` (must compile clean) + a visual checkpoint. Spec: `docs/superpowers/specs/2026-05-30-flat-baseball-field-design.md`.

**Reference colors (locked):**
- bg gradient `#047857` → `#064e3b`; pinstripe `rgba(255,255,255,0.10)`
- tan diamond `#b45309`; white outline / bases / rubber dot `#fff7ed`
- mound `#d97706`; base border `#92400e`
- label pill bg `rgba(255,255,255,0.85)`, text `#334155`
- board pill bg `rgba(6,78,59,0.7)`, text `#d1fae5`

---

## Task 1: Replace field background (gradient + pinstripes)

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (`drawField()` background section, ~lines 72-105)

- [ ] **Step 1: Replace the background + outfield block**

In `drawField()`, replace everything from `ctx.clearRect(...)` through the end of the **outfield fence** stroke (the radial gradient, outfield fan, warning track, and fence — currently ~lines 72-105) with:

```ts
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
```

Leave the rest of `drawField()` (infield dirt, infield grass, base paths, base lines, foul lines, mound, plate, bases, batter boxes) in place for now — later tasks replace them.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: completes with no TypeScript errors.

- [ ] **Step 3: Visual checkpoint**

Start the app (`npm start`), open the host page, start a game to reach the game screen. Expected: solid green vertical-gradient field with faint vertical stripes behind the (still old-style) diamond.

- [ ] **Step 4: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Replace field background with green pinstripe gradient"
```

---

## Task 2: Add rounded-diamond path helper

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (add private helper method)

- [ ] **Step 1: Add the helper**

Add this private method to the `BaseballFieldRenderer` class (e.g. just above `drawHomePlate`). It traces a diamond whose four points are `radius` from `(cx,cy)` along the axes, with corners rounded by `r`:

```ts
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
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors (helpers are unused so far — acceptable; they are used in Task 3).

- [ ] **Step 3: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Add rounded-diamond path helper"
```

---

## Task 3: Draw tan diamond + white basepath outline

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (`drawField()` infield section)

- [ ] **Step 1: Replace the infield dirt + infield grass + base paths + base lines + foul lines blocks**

In `drawField()`, remove the existing **infield dirt** fill, **infield grass** rounded shape, **base paths** stroke, **base lines** strokes, and **foul lines** dashed strokes (everything from the `// Infield dirt area` comment through `ctx.setLineDash([]);`). Replace with:

```ts
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
```

Note: `center`, `bd`, `home/first/second/third` are already destructured at the top of `drawField()`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Visual checkpoint**

Reload host game screen. Expected: a large rounded tan diamond with a white rounded outline square passing through the four base spots. (Old mound/plate/bases still drawn on top — replaced next.)

- [ ] **Step 4: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Draw tan diamond and white basepath outline"
```

---

## Task 4: Restyle pitcher's mound

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (`drawField()` mound section)

- [ ] **Step 1: Replace the mound block**

Replace the existing **Pitcher's mound** block (the `moundR` circle + white `rubberW` rect) with:

```ts
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
```

(The mound is centered at `center`, matching the reference's centered mound, rather than the old `pitcher` offset.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 3: Visual checkpoint**

Reload. Expected: an amber circle with a small white center dot at the middle of the diamond.

- [ ] **Step 4: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Restyle pitcher's mound to amber circle with rubber dot"
```

---

## Task 5: Restyle bases and home plate

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (`drawBase`, `drawHomePlate`, and `drawField()` base-drawing + batter-box section)

- [ ] **Step 1: Rewrite `drawBase`**

Replace the body of `private drawBase(x, y, size)` with a white rounded square, rotated 45°, amber border:

```ts
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
```

- [ ] **Step 2: Rewrite `drawHomePlate`**

Replace the body of `private drawHomePlate(x, y, size)` with a downward-pointing pentagon, amber border:

```ts
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
```

- [ ] **Step 3: Update the base-drawing block in `drawField()` and remove batter boxes**

Replace the **Home plate**, **Bases**, and **Batter's boxes** section near the end of `drawField()` with:

```ts
    // Bases (chunky rounded squares)
    const baseSize = Math.max(14, bd * 0.3);
    this.drawBase(first.x, first.y, baseSize);
    this.drawBase(second.x, second.y, baseSize);
    this.drawBase(third.x, third.y, baseSize);

    // Home plate (pentagon, point down)
    this.drawHomePlate(home.x, home.y, baseSize * 0.6);
```

Delete the call to `this.drawBatterBox(...)`. Then delete the now-unused `private drawBatterBox(...)` method entirely.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: no errors, and no "unused method" issue (`drawBatterBox` removed).

- [ ] **Step 5: Visual checkpoint**

Reload. Expected: three white rounded diamond bases at 1B/2B/3B and a white pentagon home plate pointing down, all with thin brown borders. No batter's boxes.

- [ ] **Step 6: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Restyle bases as rounded squares and pentagon home plate"
```

---

## Task 6: Add base labels and "BASEBALL BOARD" pill

**Files:**
- Modify: `src/host/renderer/baseball-field.ts` (add label/pill helpers + calls in `drawField()`)

- [ ] **Step 1: Add a pill-drawing helper**

Add this private method to the class:

```ts
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
```

- [ ] **Step 2: Add label + board-pill calls at the end of `drawField()`**

At the very end of `drawField()` (after bases/home plate), add:

```ts
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
```

Note: `tanRadius` is defined in Task 3's infield block within the same `drawField()` scope — ensure it remains declared above this code. `baseSize` is declared in Task 5's block. Both are in scope.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: no errors.

- [ ] **Step 4: Visual checkpoint**

Reload. Expected: white pill labels HOME/1B/2B/3B beside their bases, and a dark-green "BASEBALL BOARD" pill above the diamond — matching the reference image.

- [ ] **Step 5: Commit**

```bash
git add src/host/renderer/baseball-field.ts
git commit -m "Add base labels and BASEBALL BOARD pill"
```

---

## Task 7: Harmonize game-screen background (CSS)

**Files:**
- Modify: `public/styles/host.css` (`#game-screen`, ~line 150)

- [ ] **Step 1: Update background color**

Change `#game-screen`'s `background: #1a472a;` to an emerald tone matching the field:

```css
#game-screen {
  background: #064e3b;
  flex-direction: column;
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: no errors (build copies `public/` to `dist/`).

- [ ] **Step 3: Visual checkpoint**

Reload host game screen. Expected: the header strip / any area outside the field canvas now reads as deep emerald, harmonizing with the field.

- [ ] **Step 4: Commit**

```bash
git add public/styles/host.css
git commit -m "Harmonize game-screen background with new field"
```

---

## Task 8: Final verification (animations + full field)

**Files:** none (verification only)

- [ ] **Step 1: Confirm positions/animations untouched**

Run: `git diff 6bb2d26 -- src/host/renderer/baseball-field.ts | grep -E "calculatePositions|FieldPositions|drawRunners|drawAllRunners|resize\(\)"`
Expected: no lines showing changes to the bodies of `calculatePositions`, `resize`, `drawRunners`, `drawAllRunners`, or the `FieldPositions` interface (only call sites / surrounding context, not their logic).

- [ ] **Step 2: Visual regression of animations**

Run the app and play through correct answers producing each outcome: single, double, triple, homerun (with fireworks), walk, and a strikeout. Expected: runner dots and the ball animate along/around the bases and align with the new bases; the big "K" and outcome text still render; team runner circles sit on the correct bases between plays.

- [ ] **Step 3: Build clean + final commit (if any stray changes)**

Run: `npm run build`
Expected: clean. If `git status` is clean, nothing to commit.
