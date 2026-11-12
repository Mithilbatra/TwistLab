import { describe, expect, it } from 'vitest';
import { AnimationQueue, type Turn } from './animation/AnimationQueue';
import { applyMove, applyMoves, type CubeState, type Cubie } from './core/CubeState';
import { createMove, formatMoves, invertMoves, type Move } from './core/Move';
import { PUZZLES } from './puzzles';
import type { CubePuzzle } from './puzzles/cubePuzzle';

const cube3 = PUZZLES['3x3'];
const cube2 = PUZZLES['2x2'];

function moves(puzzle: CubePuzzle, algorithm: string): Move[] {
  const parsed = puzzle.parse(algorithm);
  if (!parsed.ok) throw new Error(`${algorithm}: ${parsed.error.message}`);
  return parsed.moves;
}

const run = (puzzle: CubePuzzle, algorithm: string, from: CubeState = puzzle.createSolved()) =>
  applyMoves(from, moves(puzzle, algorithm));

/** Seeded PRNG (mulberry32), so a failing random case can be replayed from its seed. */
function seeded(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random moves drawn from everything the puzzle supports: faces, slices, wide moves and rotations. */
function randomMoves(puzzle: CubePuzzle, length: number, random: () => number): Move[] {
  const bases = Object.keys(puzzle.table);
  return Array.from({ length }, () => {
    const base = bases[Math.floor(random() * bases.length)];
    return createMove(base, puzzle.table[base], random() < 0.3, random() < 0.5);
  });
}

/** How many times an algorithm must be repeated before the cube is solved again. */
function order(puzzle: CubePuzzle, algorithm: string): number {
  const sequence = moves(puzzle, algorithm);
  let state = applyMoves(puzzle.createSolved(), sequence);
  let count = 1;
  while (!puzzle.isSolved(state)) {
    state = applyMoves(state, sequence);
    if (++count > 5000) throw new Error(`${algorithm} never returns to solved`);
  }
  return count;
}

const cubieAt = (state: CubeState, home: string) => state.find((c) => c.home.join() === home)!;
const edit = (state: CubeState, home: string, change: Partial<Cubie>): CubeState =>
  state.map((c) => (c.home.join() === home ? { ...c, ...change } : c));

describe.each([cube3, cube2])('$name: move algebra', (puzzle) => {
  const solved = puzzle.createSolved();

  it("R followed by R' restores the original state", () => {
    expect(run(puzzle, "R R'")).toEqual(solved);
  });

  it("U followed by U' restores the original state", () => {
    expect(run(puzzle, "U U'")).toEqual(solved);
  });

  it('R2 equals R followed by R', () => {
    expect(run(puzzle, 'R2')).toEqual(run(puzzle, 'R R'));
    expect(run(puzzle, 'R2')).not.toEqual(solved);
  });

  it('four R moves restore the original state', () => {
    expect(run(puzzle, 'R R R')).not.toEqual(solved);
    expect(run(puzzle, 'R R R R')).toEqual(solved);
  });

  it('every move followed by its inverse restores every position and orientation', () => {
    const scrambled = applyMoves(solved, puzzle.scramble(seeded(1)));
    for (const base of Object.keys(puzzle.table))
      for (const double of [false, true])
        for (const prime of [false, true]) {
          const move = createMove(base, puzzle.table[base], double, prime);
          const turned = applyMove(scrambled, move);
          expect(turned, move.notation).not.toEqual(scrambled);
          expect(applyMove(turned, puzzle.invert(move)), move.notation).toEqual(scrambled);
        }
  });

  it('a reversed algorithm is the inverse of the original (300 random algorithms)', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const random = seeded(seed);
      const start = applyMoves(solved, puzzle.scramble(random));
      const algorithm = randomMoves(puzzle, 1 + Math.floor(random() * 60), random);
      const there = applyMoves(start, algorithm);
      expect(applyMoves(there, invertMoves(algorithm)), `seed ${seed}`).toEqual(start);
    }
  });

  it('a scramble followed by its inverse solves the cube', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const scramble = puzzle.scramble(seeded(seed));
      const scrambled = applyMoves(solved, scramble);
      expect(puzzle.isSolved(scrambled), `seed ${seed}`).toBe(false);
      const back = applyMoves(scrambled, invertMoves(scramble));
      expect(back, `seed ${seed}`).toEqual(solved);
      expect(puzzle.isSolved(back)).toBe(true);
    }
  });

  it('stays valid through a long random walk', () => {
    let state = solved;
    for (const [step, move] of randomMoves(puzzle, 3000, seeded(7)).entries()) {
      state = applyMove(state, move);
      const problems = puzzle.validate(state);
      if (problems.length > 0) throw new Error(`invalid after move ${step + 1} (${move.notation}): ${problems.join('; ')}`);
    }
    expect(state).toHaveLength(solved.length);
    expect(new Set(state.map((c) => c.pos.join())).size).toBe(solved.length);
    expect(state.map((c) => c.home)).toEqual(solved.map((c) => c.home));
  });
});

describe('cube conventions', () => {
  it('builds 26 visible cubies for a 3×3 and 8 for a 2×2', () => {
    expect(cube3.createSolved()).toHaveLength(26);
    expect(cube2.createSolved()).toHaveLength(8);
  });

  it('turns each face clockwise as seen from outside', () => {
    const ufr = (algorithm: string) => cubieAt(run(cube3, algorithm), '2,2,2').pos;
    const dbl = (algorithm: string) => cubieAt(run(cube3, algorithm), '-2,-2,-2').pos;
    expect(ufr('R')).toEqual([2, 2, -2]); // up-front-right goes to the back
    expect(ufr('U')).toEqual([-2, 2, 2]); // … to the left
    expect(ufr('F')).toEqual([2, -2, 2]); // … down
    expect(dbl('L')).toEqual([-2, 2, -2]); // down-back-left goes up
    expect(dbl('D')).toEqual([-2, -2, 2]); // … to the front
    expect(dbl('B')).toEqual([2, -2, -2]); // … to the right
  });

  it('carries stickers with their cubie', () => {
    // After R the front sticker of the up-front-right corner faces up: rot · ẑ = ŷ.
    const { rot } = cubieAt(run(cube3, 'R'), '2,2,2');
    expect([rot[2], rot[5], rot[8]]).toEqual([0, 1, 0]);
  });

  it('defines slices, wide moves and rotations in terms of face turns', () => {
    const same = (a: string, b: string) => expect(run(cube3, a), `${a} = ${b}`).toEqual(run(cube3, b));
    same('M', "x' L' R");
    same('E', "y' D' U");
    same('S', "z F' B");
    same('r', "R M'");
    same('l', 'L M');
    same('u', "U E'");
    same('d', 'D E');
    same('f', 'F S');
    same('b', "B S'");
    same('x', "R M' L'");
    same('y', "U E' D'");
    same('z', "F S B'");
    same('Rw Uw2', 'r u2');
  });

  it('reproduces the known orders of classic sequences', () => {
    expect(order(cube3, "R U R' U'")).toBe(6);
    expect(order(cube3, 'R U')).toBe(105);
    expect(order(cube3, "R U2 D' B D'")).toBe(1260);
    expect(order(cube2, 'R U')).toBe(15);
  });

  it('judges solved by what the stickers show, not by where cubies are', () => {
    const rotated = run(cube3, 'x y z2');
    expect(rotated).not.toEqual(cube3.createSolved());
    expect(cube3.isSolved(rotated)).toBe(true);

    // (R U R' U)5 only twists the up centre, which no sticker reveals.
    const centreTwisted = run(cube3, "(R U R' U)5");
    expect(centreTwisted).not.toEqual(cube3.createSolved());
    expect(cube3.isSolved(centreTwisted)).toBe(true);
    expect(cube3.validate(centreTwisted)).toEqual([]);

    expect(cube3.isSolved(run(cube3, 'M2 E2 S2'))).toBe(false);
    expect(cube3.isSolved(run(cube3, 'R'))).toBe(false);
    expect(cube2.isSolved(run(cube2, 'x2 y'))).toBe(true);
  });
});

describe('validator', () => {
  const solved = cube3.createSolved();

  it('accepts the solved cube', () => {
    expect(cube3.validate(solved)).toEqual([]);
    expect(cube2.validate(cube2.createSolved())).toEqual([]);
  });

  it('rejects a corner twisted in place', () => {
    const twist = [0, 0, 1, 1, 0, 0, 0, 1, 0]; // 120° about the cube diagonal: the corner stays put
    expect(cube3.validate(edit(solved, '2,2,2', { rot: twist }))).toEqual([expect.stringContaining('corner')]);
    expect(cube2.validate(edit(cube2.createSolved(), '1,1,1', { rot: twist }))).toEqual([
      expect.stringContaining('corner'),
    ]);
  });

  it('rejects an edge flipped in place', () => {
    const flip = [0, 1, 0, 1, 0, 0, 0, 0, -1]; // 180° about the axis through the up-right edge
    expect(cube3.validate(edit(solved, '2,2,0', { rot: flip }))).toEqual([expect.stringContaining('edge')]);
  });

  it('rejects two swapped pieces', () => {
    const half = [-1, 0, 0, 0, 1, 0, 0, 0, -1]; // 180° about y carries up-right onto up-left and back
    const swapped = edit(edit(solved, '2,2,0', { pos: [-2, 2, 0], rot: half }), '-2,2,0', { pos: [2, 2, 0], rot: half });
    expect(cube3.validate(swapped)).toEqual([expect.stringContaining('swapped')]);
  });

  it('rejects centres that no turn could arrange', () => {
    const swapped = edit(
      edit(solved, '0,2,0', { pos: [0, 0, 2], rot: [1, 0, 0, 0, 0, -1, 0, 1, 0] }),
      '0,0,2',
      { pos: [0, 2, 0], rot: [1, 0, 0, 0, 0, 1, 0, -1, 0] },
    );
    expect(cube3.validate(swapped)).toContainEqual(expect.stringContaining('centres'));
  });

  it('rejects structurally broken states', () => {
    const mirrored = edit(solved, '2,2,2', { rot: [-1, 0, 0, 0, 1, 0, 0, 0, 1] });
    expect(cube3.validate(mirrored)).toEqual([expect.stringContaining('not a rotation')]);
    const detached = edit(solved, '2,2,2', { pos: [2, 2, -2] });
    expect(cube3.validate(detached)).toContainEqual(expect.stringContaining('not where'));
    expect(cube3.validate(detached)).toContainEqual(expect.stringContaining('same position'));
  });
});

describe('algorithm parser', () => {
  const notation = (algorithm: string, puzzle = cube3) => formatMoves(moves(puzzle, algorithm));

  it('reads standard notation, with or without spaces', () => {
    expect(notation("R U R' U'")).toBe("R U R' U'");
    expect(notation("RUR'U'")).toBe("R U R' U'");
    expect(notation("  F2 r' M E2 S' x y' z2\n Rw Uw2 ")).toBe("F2 r' M E2 S' x y' z2 r u2");
    expect(notation("R’ U′ R2' L'2")).toBe("R' U' R2 L2");
    expect(notation('')).toBe('');
  });

  it('expands groups and repeat counts', () => {
    expect(notation("(R U R' U')3")).toBe(Array(3).fill("R U R' U'").join(' '));
    expect(notation('(R (U F)2)2 L')).toBe('R U F U F R U F U F L');
    expect(notation('()')).toBe('');
  });

  it('keeps the written direction of a double turn', () => {
    expect(moves(cube3, "R2 R2'").map((move) => move.turns)).toEqual([-2, 2]);
  });

  it.each<[string, number, string]>([
    ['R U Q', 4, 'not a move'],
    ['R, U', 1, 'not a move'],
    ['R3', 0, 'not a turn'],
    ['R22', 0, 'not a turn'],
    ['R u1', 2, 'not a turn'],
    ['2R', 0, 'no move before it'],
    ["'R", 0, 'no move before it'],
    ["R''", 2, 'no move before it'],
    ['R 2', 2, 'no move before it'],
    ['xw', 0, 'wide turns'],
    ['(R U', 0, 'never closed'],
    ['R (U (F)', 2, 'never closed'],
    ['R U)', 3, 'no matching'],
    ['(R U)0', 0, 'repeat'],
    ['(R U)100', 0, 'repeat'],
    ['((R U)99)99', 10, 'limited to'],
    ['('.repeat(5000), 16, 'nested too deeply'],
  ])('rejects %j at index %i', (input, index, hint) => {
    const result = cube3.parse(input);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.index).toBe(index);
    expect(result.error.message).toContain(hint);
  });

  it('rejects moves the puzzle does not have', () => {
    expect(cube2.parse('R M U')).toMatchObject({ ok: false, error: { index: 2, message: 'This puzzle has no M move' } });
    expect(cube2.parse("R r'")).toMatchObject({ ok: false, error: { index: 2 } });
    expect(notation("R U' F2 x y' z2", cube2)).toBe("R U' F2 x y' z2");
  });

  it('reverses an algorithm into its inverse', () => {
    expect(formatMoves(invertMoves(moves(cube3, "R U R' U' F2 M'")))).toBe("M F2 U R U' R'");
  });
});

describe('scramble generator', () => {
  it.each([
    [cube3, 20],
    [cube2, 10],
  ])('$name: produces valid, non-trivial scrambles', (puzzle, length) => {
    for (let seed = 1; seed <= 200; seed++) {
      const scramble = puzzle.scramble(seeded(seed));
      expect(scramble).toHaveLength(length);
      scramble.forEach((move, i) => {
        expect(move.base, `seed ${seed}`).not.toBe(scramble[i - 1]?.base);
        // never three turns in a row on one axis (R L R)
        expect(new Set([move.axis, scramble[i - 1]?.axis, scramble[i - 2]?.axis]).size, `seed ${seed}`).toBeGreaterThan(1);
      });
      const state = applyMoves(puzzle.createSolved(), scramble);
      expect(puzzle.validate(state), `seed ${seed}`).toEqual([]);
      expect(puzzle.isSolved(state), `seed ${seed}`).toBe(false);
    }
  });

  it('is reproducible from a seed and varies between seeds', () => {
    expect(formatMoves(cube3.scramble(seeded(42)))).toBe(formatMoves(cube3.scramble(seeded(42))));
    expect(formatMoves(cube3.scramble(seeded(42)))).not.toBe(formatMoves(cube3.scramble(seeded(43))));
  });
});

describe('animation queue', () => {
  const solved = cube3.createSolved();

  function turnsFor(algorithm: string): Turn<CubeState, Move>[] {
    let state = solved;
    return moves(cube3, algorithm).map((move) => {
      const from = state;
      state = applyMove(state, move);
      return { move, from, to: state };
    });
  }

  it('comes to rest on exactly the logical state', () => {
    const queue = new AnimationQueue<CubeState, Move>(solved);
    const turns = turnsFor("R U R' U' F2");
    const logical = turns.map((turn) => turn.to);
    turns.forEach((turn) => queue.enqueue(turn));
    expect(queue.current).toBe(turns[0]);
    expect(queue.backlog).toBe(4);

    // Uneven steps: completion must not depend on progress landing exactly on 1.
    for (let i = 0; i < 100 && queue.busy; i++) queue.tick(0.37);

    expect(queue.busy).toBe(false);
    expect(queue.displayed).toBe(turns[4].to);
    expect(queue.displayed).toEqual(run(cube3, "R U R' U' F2"));
    // Animating never touched the states the engine produced.
    expect(turns.map((turn) => turn.to)).toEqual(logical);
    expect(logical[4]).toEqual(run(cube3, "R U R' U' F2"));
  });

  it('holds the previous state mid-turn, then snaps to the exact result', () => {
    const queue = new AnimationQueue<CubeState, Move>(solved);
    const [turn] = turnsFor('R');
    queue.enqueue(turn);
    queue.tick(0.5);
    expect(queue.displayed).toBe(solved);
    expect(queue.progress).toBe(0.5);
    queue.tick(0.6);
    expect(queue.displayed).toBe(turn.to);
    expect(queue.current).toBeNull();
    expect(queue.progress).toBe(0);
  });

  it('plays turns queued mid-animation in order, one at a time', () => {
    const queue = new AnimationQueue<CubeState, Move>(solved);
    const turns = turnsFor('R U F');
    queue.enqueue(turns[0]);
    queue.tick(0.4);
    queue.enqueue(turns[1]);
    queue.enqueue(turns[2]);
    expect(queue.current).toBe(turns[0]);
    queue.tick(1);
    expect(queue.current).toBe(turns[1]);
    expect(queue.displayed).toBe(turns[0].to);
    queue.tick(1);
    queue.tick(1);
    expect(queue.displayed).toBe(turns[2].to);
  });

  it('drops everything on reset and releases anyone waiting', async () => {
    const queue = new AnimationQueue<CubeState, Move>(solved);
    turnsFor('R U F').forEach((turn) => queue.enqueue(turn));
    queue.tick(0.5);
    const idle = queue.whenIdle();
    queue.reset(solved);
    await idle;
    expect(queue.busy).toBe(false);
    expect(queue.backlog).toBe(0);
    expect(queue.displayed).toBe(solved);
  });

  it('wakes listeners when work arrives and completes turns at once in instant mode', async () => {
    const queue = new AnimationQueue<CubeState, Move>(solved);
    let woken = 0;
    const unsubscribe = queue.subscribe(() => woken++);
    const turns = turnsFor('R U');
    queue.enqueue(turns[0]);
    expect(woken).toBe(1);
    queue.instant = true;
    queue.enqueue(turns[1]);
    await queue.whenIdle();
    expect(queue.displayed).toBe(turns[1].to);
    unsubscribe();
    queue.enqueue(turns[0]);
    expect(woken).toBe(2);
  });
});
