# Flat Modern Baseball Field Redesign

**Date:** 2026-05-30
**Scope:** Restyle the host baseball field to match the reference design (ChatGPT canvas "棒球互動 Board Game MVP"). Field visuals + field-area chrome (board pill, base labels, pinstripe background). No scoreboard/page redesign.

## Goal

Replace the current "realistic" top-down field (radial gradient, fan outfield, warning track, fence, foul lines, batter's boxes, infield-grass center) with a flatter, bolder, modern look: green mowing-stripe background, one large rounded tan diamond, a white basepath outline, a circular amber mound, chunky white bases + pentagon home plate with labels, and a "BASEBALL BOARD" pill at the top.

## Constraints

- **Animations must keep working unchanged.** `animations.ts` (runner/ball/fireworks) reads `FieldPositions` (home/first/second/third/pitcher/center/baseDistance) to position its overlay drawing. Therefore `calculatePositions()` and the `FieldPositions` interface **must not change**. Only the visual painting in `drawField()` and its helpers changes.
- **Multi-team support preserved.** `drawRunners()` / `drawAllRunners()` stay as-is (colored team circles + team letter, side-by-side offset). Up to 4 teams.
- Canvas-based rendering is retained (not converted to DOM). The field fills `#field-container` (full width, `flex: 1`), which is not necessarily square — the diamond stays centered using the existing position math; surrounding space is filled with the pinstripe background.

## Reference mapping

Source reference is a React/Tailwind component. Tailwind values map to canvas as:

| Reference (Tailwind) | Canvas value |
|---|---|
| `from-emerald-700 to-emerald-900` | vertical gradient `#047857` → `#064e3b` |
| pinstripe `rgba(255,255,255,.18)` @ 25% opacity, 24px bands | `rgba(255,255,255,0.10)`, ~24px on/off vertical bands |
| tan diamond `bg-amber-700/95` | `#b45309` |
| white outline `border-orange-50/90` | `#fff7ed` |
| mound `bg-amber-600/90` | `#d97706` |
| rubber dot `bg-orange-50/90` | `#fff7ed` |
| base fill `bg-orange-50`, border `border-amber-800` | fill `#fff7ed`, stroke `#92400e` |
| label pill `bg-white/80 text-slate-700` | bg `rgba(255,255,255,0.85)`, text `#334155` |
| board pill `bg-emerald-950/70 text-emerald-100` | bg `rgba(6,78,59,0.7)`, text `#d1fae5` |

## Draw order (back to front) in `drawField()`

1. **Background** — fill canvas with vertical gradient `#047857`→`#064e3b`, then overlay vertical pinstripe bands (`rgba(255,255,255,0.10)`, ~24px on / 24px off).
2. **"BASEBALL BOARD" pill** — rounded-rect `rgba(6,78,59,0.7)` with light letter-spaced text `#d1fae5`, centered horizontally near the top of the field (above the diamond).
3. **Tan diamond** — one large rounded diamond filled `#b45309`. Corners extend ~`bd * 1.18` from center along each axis (i.e. ~18% beyond the bases), with rounded corners. No separate infield-grass center.
4. **White basepath outline** — thick (`~bd*0.05`, min ~6px) rounded white diamond `#fff7ed` connecting the four base positions (home/first/second/third).
5. **Pitcher's mound** — filled amber circle `#d97706` radius ~`bd*0.42` at `center`, plus a small white rubber dot `#fff7ed` radius ~40% of the mound.
6. **Bases** — chunky white rounded squares (rotated 45°), size ~`bd*0.3`, fill `#fff7ed`, stroke `#92400e` (~2px), at first/second/third. **Pentagon home plate** (point down) at home, same fill/stroke, comparable size.
7. **Base labels** — small white rounded pills (`rgba(255,255,255,0.85)`, text `#334155`, bold) placed just outside each base away from center: `HOME` below home, `2B` above second, `1B` right of first, `3B` left of third.

After `drawField()`, the host calls `drawAllRunners(teams)` (unchanged) which paints team runner circles on top.

## Sizing

All sizes are ratios of `baseDistance` (`bd`) so the field scales with the container, mirroring the existing renderer's approach. The ratios above are starting values; exact proportions (diamond margin, base size, mound radius, pill/label sizes, corner radii) will be fine-tuned by running the app and comparing against the reference image. Use `Math.max(px, bd*ratio)` floors (as the current code does) so elements stay legible on small canvases.

## Files touched

- `src/host/renderer/baseball-field.ts` — rewrite `drawField()`; replace/add helpers: keep `drawBase`, `drawHomePlate` (restyled), add a rounded-diamond path helper, a label-pill helper, and a board-pill helper. Remove outfield/warning-track/fence/foul-line/batter-box/infield-grass code. `drawRunners`/`drawAllRunners`/`calculatePositions`/`FieldPositions`/`resize` unchanged.
- `public/styles/host.css` — update `#game-screen` and/or `#field-container` background from `#1a472a` to an emerald tone harmonizing with the new field.

## Out of scope

- Scoreboard, header, overlays, action cards, page background beyond the field area.
- Animation logic and runner styling (kept as-is).
- Player client (`player.html` / `player.css`).

## Verification

- `npm run build` succeeds with no TypeScript errors.
- Run the app and visually compare the field against the reference image: pinstripes, tan diamond, white outline, mound, labeled bases, board pill.
- Trigger outcomes (single/double/triple/homerun/walk/strikeout) and confirm runner/ball animations still align with the bases on the new field.
