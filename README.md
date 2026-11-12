# TwistLab

An interactive 3D playground for twisty puzzles. Turn a real 3D cube with the keyboard or by dragging its faces, run algorithms move by move, learn the beginner's method on the cube itself, and time your solves.

The 2×2 and 3×3 are fully implemented. 4×4, Pyraminx, Megaminx and Skewb are listed as upcoming and plug into the same engine interface.

## Features

- **3D cube** built from individual cubies (26 on a 3×3, 8 on a 2×2) with rounded plastic bodies and raised stickers, studio lighting, a floor of dots and contact shadows.
- **An interface made of cube parts.** The six sections are the six faces: each has a sticker colour, and that colour becomes the accent of the whole interface while the section is open. Every move is drawn as a sticker in the colour of the face it turns, so an algorithm reads as a strip of colour.
- **Turn it** with the keyboard, by dragging a face, or with notation. Orbit, zoom, reset the camera and change the perspective.
- **Algorithm playground**: a real parser with clear syntax errors, play / pause / resume, step forward and back, reverse, copy, adjustable speed.
- **Scramble, reset, undo, redo** and a full move history.
- **Algorithm Lab**: 61 checked algorithms across OLL, PLL (all 21), F2L, cross, beginner method, two-look CFOP and finger tricks. Each one sets up the case it solves and plays step by step. Favourites are saved.
- **Learn**: the seven-step layer-by-layer method. Each step greys out the pieces you do not need yet, demonstrates its algorithms on the cube, and gives random practice positions that are judged on the cube's real state.
- **Timer**: Space to start and stop, configurable inspection, scrambles shown on the cube, best / mean / average of 5 / average of 12, a time-distribution chart, per-solve delete. Saved in the browser.
- **A stage that reacts**: the last move stands behind the cube in dot-matrix type, the light behind the cube takes the colour of the face that turned, and all six colours bloom when the cube comes out solved.
- **Responsive**: a rail of six stickers and a control panel on desktop, a tab bar and stacked layout on phones.

## Quick start

Requires Node 20.19 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:5173.

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run typecheck` | Type-check only |
| `npm test` | Unit and component tests (Vitest) |
| `npm run test:watch` | The same, in watch mode |
| `npm run test:e2e` | End-to-end tests (Playwright) |

The end-to-end tests run in the Chrome already installed on your machine. To use Playwright's own Chromium instead, remove the `channel` line in `playwright.config.ts` and run `npx playwright install chromium`.

## Controls

### Keyboard

| Key | Action |
| --- | --- |
| `R` `L` `U` `D` `F` `B` | Turn that face clockwise |
| `M` `E` `S` | Slice turns (3×3) |
| `X` `Y` `Z` | Rotate the whole cube |
| `Shift` + key | The same turn counter-clockwise |
| `Alt` / `⌥` + face key | Wide turn: the face and the slice beside it (3×3) |
| same key twice | Half turn |
| `Space` | Play or pause the loaded sequence |
| `←` `→` | Step back or forward through the sequence |
| `Ctrl` / `⌘` + `Z` | Undo |
| `Ctrl` / `⌘` + `Shift` + `Z`, or `Ctrl` + `Y` | Redo |
| `Enter` in the algorithm field | Execute |

In the timer: hold `Space` and release to start (inspection first, if enabled), press `Space` to stop, `Esc` to cancel the attempt. Cube keys are off while the timer section is open.

Every move key can be changed in **Settings → Keyboard**. Shortcuts never fire while you are typing in a field, and the in-app reference (**Shortcuts** in the bottom bar) always shows the keys as currently bound.

### Mouse and touch

- Drag a face to turn the layer under the pointer. The layer follows the drag direction, as on a real cube.
- Drag the background to orbit. Scroll or pinch to zoom.
- The buttons at the bottom right of the stage zoom, reset the camera and change the perspective.

### Notation

```
R U R' U'          faces, with ' for counter-clockwise
R2 U2'             half turns
M E S              slices        (follow L, D and F)
r l u d f b        wide turns    (Rw, Lw … also accepted)
x y z              rotations     (follow R, U and F)
(R U R' U')3       groups with a repeat count, nestable
RUR'U'             spaces are optional
```

One bad token rejects the whole algorithm, with the reason and its position. Nothing is partly executed.

## Architecture

```
src/
  engine/                 pure TypeScript, no React, no three.js
    core/
      math.ts             integer vectors and rotation matrices
      Move.ts             move type, move tables, inversion, formatting
      CubeState.ts        cubies, applying moves, the solved test
      MoveParser.ts       notation parser with positioned errors
      CubeValidator.ts    reachability checks
      scramble.ts         scramble generator
    puzzles/
      PuzzleEngine.ts     the interface every puzzle implements
      cubePuzzle.ts       n×n×n cube implementation
      index.ts            registry of available and upcoming puzzles
    animation/
      AnimationQueue.ts   sequences turn animations, framework-free
    algorithms/
      AlgorithmLibrary.ts the algorithm data
      lessons.ts          lesson data, stage logic, practice generator
  store/                  Zustand stores: cube, algorithm playback, timer, settings
  hooks/useKeyboard.ts    global shortcuts
  components/             cube (3D), layout, algorithm, timer, statistics, ui
  pages/                  one panel per section
  utils/stats.ts          time formatting, averages, histogram
e2e/                      Playwright tests
```

Data flows one way:

```
key / drag / notation ──▶ cube store ──▶ engine.apply ──▶ new logical state   (synchronous, exact)
                              │
                              └──▶ AnimationQueue { move, from, to } ──▶ CubeModel draws it each frame
```

### The engine

A cube is a list of **cubies**. Each cubie is a rigid body with a position and an orientation, and nothing else. Sticker colours are never stored or permuted: a sticker is simply whichever home face of a cubie currently points outwards. This is what makes it impossible to "fake" a move by repainting stickers.

- **Coordinates.** Layers along each axis sit at `-(n-1) … n-1` in steps of 2, so they are integers for every size: `-2, 0, 2` on a 3×3 and `-1, 1` on a 2×2. `+x` is right, `+y` is up, `+z` is front.
- **Orientation** is a 3×3 rotation matrix. Every legal turn is a multiple of 90° about a coordinate axis, so every matrix entry is -1, 0 or 1.
- **A move** rotates every cubie in its layers: `pos' = R · pos` and `rot' = R · rot`, with the same `R` for both. `turns` is the signed number of quarter turns about the positive axis (right-hand rule), so `R`, clockwise when you look at the right face, is -1 about `+x`.
- **No drift.** The engine is integer-only. A state reached after a million moves is exactly as precise as the first one, and undo (the inverse turn) restores the previous state bit for bit.
- **Solved** is judged by stickers, not positions: all stickers that started on one face must still point the same way. A cube rotated as a whole is solved, and so is one whose centres have been twisted in place.
- **Validation** (`CubeValidator.ts`) checks structure (proper rotations, `pos = rot · home`, no shared positions) and the quantities every legal turn preserves: corner twist is a multiple of 3, edge flip is even, the permutation of all 26 cubies is even, and the centres move as one rigid frame.

### Logic first, animation after

The logical state updates **synchronously** on every move and never waits for an animation. Each turn is then queued for the renderer together with the exact engine state before and after it.

`CubeModel` does not integrate anything over time. Every frame it places each cubie from an exact engine state, then rotates the cubies of the turning layer together about the turn axis by the eased angle. When a turn finishes, the next frame draws the exact state after it. So:

- rendered and logical state cannot diverge, whatever is queued, sped up or interrupted;
- overlapping input is safe: turns queue up, and a backlog (a scramble, fast typing) simply plays faster;
- animating allocates nothing per frame and causes no React re-renders;
- the canvas renders on demand, so an idle cube costs no GPU time.

Turns are tweened in the React Three Fiber frame loop with a cubic ease, rather than with a separate animation library. One clock drives everything, and the queue can be stepped deterministically in tests.

### The look

The interface is built from the cube itself, in three ideas. The tokens and the handful of custom utilities behind them are in `src/index.css`.

- **Six faces, six colours.** `NAV` in `Sidebar.tsx` gives each section a face. The app root carries it as `data-sticker`, and CSS turns that into the accent colour for everything inside.
- **Moves are stickers.** `turnedFace` in `CubeState.ts` reads the colour of the face a move turns off the centres, so the colour is right however the cube is held: on a cube held yellow-up, `U` is a yellow sticker. Slices and rotations turn no single face and stay grey, and so does every move on a 2×2, which has no centres. `turnedFaces` does this for a whole sequence, following the centres through wide moves, slices and rotations.
- **Dots.** Display type is [Doto](https://github.com/oliverlalan/Doto), a dot-matrix face whose glyphs are grids of squares. It is used large (the clock, the move on stage) and, joined into solid strokes by a hairline outline, for titles and counters. The floor under the cube is the same grid in perspective.

The stage behind the cube is plain HTML and CSS. The 3D canvas is transparent and sits in front of it, so the glow and the giant move letter are hidden by the cube exactly as if they were behind it. Nothing on the stage animates once it has settled, so an idle cube still costs no frames.

### Adding a puzzle

1. Implement `PuzzleEngine<State, Move>` (`createSolved`, `parse`, `apply`, `invert`, `isSolved`, `validate`, `scramble`, `countsAsMove`).
2. Add a 3D model component that draws from the animation queue, as `CubeModel` does for cubes.
3. Register it in `src/engine/puzzles/index.ts` and remove it from `UPCOMING`.

The stores, playback, history, timer and UI use only the engine interface. Another cube size needs less: `createCubePuzzle(n, …)` already builds the geometry, moves and scrambles, and what remains is notation for its inner layers and its parity rules in the validator.

## Testing

```bash
npm test          # 170 unit and component tests
npm run test:e2e  # 12 end-to-end tests in a real browser
```

What is verified:

- **Move algebra**, on both puzzles: `R R'` and `U U'` restore the state, `R2 = R R`, `R` four times is the identity, every move undone by its inverse (all positions and orientations), 300 random algorithms undone by their reversal, 50 scrambles undone by their inverse.
- **Conventions**: each face turns clockwise seen from outside; slices, wide moves and rotations agree with their definitions in terms of face turns (`M = x' L' R`, `r = R M'`, …).
- **Known results**: `R U R' U'` has order 6, `R U` has order 105 (15 on a 2×2), `R U2 D' B D'` has order 1260.
- **Face colours**: the colour named for each move follows the centres through rotations, slices and wide moves, and a 2×2 names none.
- **Validity**: 3000-move random walks through faces, slices, wide moves and rotations stay valid at every step; the validator rejects a twisted corner, a flipped edge, a swapped pair, impossible centres and broken structure.
- **Parser**: valid notation, groups and repeats, and 17 kinds of invalid input, each with its error position.
- **Animation**: the model comes to rest on exactly the logical state; completing animations never changes the logical state; moves, undo and redo arriving mid-animation stay consistent.
- **Algorithm library**: every OLL keeps the first two layers, every PLL only permutes the last layer, all 21 PLLs have distinct effects, F2L and cross cases touch only what they should.
- **Lessons**: each demonstration reaches its goal, practice positions keep earlier steps solved, and each situation named in the text matches the position shown.
- **Stores and UI**: undo/redo, playback, the timer state machine, statistics, corrupt saved data, shortcuts standing down while typing, key rebinding.
- **End to end**: keyboard turning, algorithm execution, drag-to-turn with the correct direction, scramble/reset, the 2×2, lab and lesson demos, timer persistence across a reload, and the phone layout.

Randomised tests use a seeded generator, so a failure names the seed that reproduces it.

## Saved data

Stored in `localStorage` under `twistlab.settings`, `twistlab.algorithms` (input, favourites, lesson progress) and `twistlab.timer` (solves). Saved data is validated when it is loaded. **Settings → Saved data** deletes solves or resets lesson progress.

There is no backend. The stores are the only place that reads or writes saved data, so accounts and sync can be added behind them.

## Known limits

- Scrambles are random-move (20 moves on a 3×3, 10 on a 2×2), not WCA random-state. Random-state scrambles need a solver.
- The timer has no +2 or DNF penalties. If inspection runs out, the solve starts.
- The Algorithm Lab and lessons are for the 3×3.
- Undo covers turns. Reset and scramble start a new history.
