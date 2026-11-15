import { describe, expect, it } from 'vitest';
import { clockTurn, FLIP, type ClockMove, type ClockState } from './clock';
import { PUZZLES } from './index';

const clock = PUZZLES.clock;
const solved = clock.createSolved();

/** Seeded PRNG (mulberry32), so a failing random case can be replayed from its seed. */
function seeded(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function moves(algorithm: string): ClockMove[] {
  const parsed = clock.parse(algorithm);
  if (!parsed.ok) throw new Error(`${algorithm}: ${parsed.error.message}`);
  return parsed.moves;
}
const play = (sequence: readonly ClockMove[], from: ClockState = solved) => sequence.reduce(clock.apply, from);
const run = (algorithm: string) => play(moves(algorithm));

describe("Rubik's Clock notation", () => {
  it('reads WCA notation and writes it back', () => {
    expect(moves('UR3+ DR0+ U2- ALL6+ y2 L1-').map((move) => move.notation)).toEqual(['UR3+', 'DR0+', 'U2-', 'ALL6+', 'y2', 'L1-']);
    expect(moves('UL1+DL2-')).toEqual(moves('UL1+ DL2-')); // spaces are optional
    const scramble = clock.scramble(seeded(4));
    expect(moves(scramble.map((move) => move.notation).join(' '))).toEqual(scramble);
  });

  it('rejects what is not a move, saying where', () => {
    const error = (algorithm: string) => {
      const parsed = clock.parse(algorithm);
      return parsed.ok ? null : parsed.error;
    };
    expect(error('UR3+ Q')).toEqual({ message: expect.stringContaining(`"Q" is not a move on a Rubik's Clock`), index: 5 });
    expect(error('UR3')).toEqual({ message: expect.stringContaining('Add + or -'), index: 0 });
    expect(error('ALL7+')).toEqual({ message: expect.stringContaining('turns too far'), index: 0 });
    expect(error('UR DL')).toEqual({ message: expect.stringContaining('needs a turn after it'), index: 0 });
    expect(error('y')).toEqual({ message: expect.stringContaining('"y" is not a move'), index: 0 });
  });
});

describe("Rubik's Clock mechanics", () => {
  it('turns the dials around the pins that are up, and the far ends of the corner axles', () => {
    // The front's top-right axle is the back's top-left, seen from behind, and turns the other way there.
    expect(run('UR3+')).toEqual({ front: [0, 3, 3, 0, 3, 3, 0, 0, 0], back: [9, 0, 0, 0, 0, 0, 0, 0, 0], flipped: false });
    expect(run('U2-').front).toEqual([10, 10, 10, 10, 10, 10, 0, 0, 0]);
    expect(run('ALL1+')).toEqual({ front: Array(9).fill(1), back: [11, 0, 11, 0, 0, 0, 11, 0, 11], flipped: false });
    expect(run('DL5+ DL5-')).toEqual(solved);
  });

  it('turns over with y2, so the next turn works on the other face', () => {
    expect(run('UR3+ y2')).toEqual({ front: [9, 0, 0, 0, 0, 0, 0, 0, 0], back: [0, 3, 3, 0, 3, 3, 0, 0, 0], flipped: true });
    expect(run('UR3+ y2 y2')).toEqual(run('UR3+'));
    // From behind, UL turns the corner whose front end is the front's top-right.
    expect(run('y2 UL1+ y2')).toEqual({ front: [0, 0, 11, 0, 0, 0, 0, 0, 0], back: [1, 1, 0, 1, 1, 0, 0, 0, 0], flipped: false });
    expect(clock.countsAsMove(FLIP)).toBe(false);
    expect(clock.countsAsMove(clockTurn('UR', 1))).toBe(true);
  });

  it('is solved only when every dial shows twelve, and stays valid however it is turned', () => {
    expect(clock.isSolved(solved)).toBe(true);
    expect(clock.isSolved(run('ALL6+ ALL6+'))).toBe(true);
    expect(clock.isSolved(run('y2'))).toBe(true);
    expect(clock.isSolved(run('R1+'))).toBe(false);
    for (let seed = 1; seed <= 30; seed++) {
      const scramble = clock.scramble(seeded(seed));
      const scrambled = play(scramble);
      expect(clock.validate(scrambled), `seed ${seed}`).toEqual([]);
      expect(play(scramble.map(clock.invert).reverse(), scrambled), `seed ${seed}`).toEqual(solved);
    }
    // A corner turned on one face only would break its axle.
    expect(clock.validate({ front: [1, 0, 0, 0, 0, 0, 0, 0, 0], back: Array(9).fill(0), flipped: false })).toHaveLength(1);
  });

  it('scrambles in the WCA format', () => {
    const scramble = clock.scramble(seeded(9)).map((move) => move.notation);
    expect(scramble).toHaveLength(15);
    expect(scramble.map((move) => move.replace(/\d[+-]$/, ''))).toEqual(['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL', 'y2', 'U', 'R', 'D', 'L', 'ALL']);
    for (const move of clock.scramble(seeded(10))) if (move.kind === 'turn') expect(move.amount).toBeGreaterThanOrEqual(-5);
  });

  it('reaches every one of its 12^14 positions, each from exactly one scramble', () => {
    // Fourteen dials move independently: all nine in front, and the five behind that are not corners. Each of
    // the scramble's fourteen turns, one hour each, is a column of its effect on them.
    const dials = (s: ClockState) => [...s.front, ...[1, 3, 4, 5, 7].map((i) => s.back[i])].map((v) => (v > 6 ? v - 12 : v));
    const columns = [
      ...['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map((pins) => dials(run(`${pins}1+`))),
      ...['U', 'R', 'D', 'L', 'ALL'].map((pins) => dials(run(`y2 ${pins}1+ y2`))),
    ];
    // The turns reach everything exactly once when that matrix can be inverted mod 12: its determinant shares no
    // factor with 12. Fraction-free (Bareiss) elimination keeps the arithmetic exact.
    const a = columns[0].map((_, row) => columns.map((column) => column[row]));
    let sign = 1;
    let previous = 1;
    for (let k = 0; k < 13; k++) {
      if (a[k][k] === 0) {
        const swap = a.findIndex((row, r) => r > k && row[k] !== 0);
        expect(swap).toBeGreaterThan(k);
        [a[k], a[swap]] = [a[swap], a[k]];
        sign = -sign;
      }
      for (let i = k + 1; i < 14; i++) for (let j = k + 1; j < 14; j++) a[i][j] = (a[i][j] * a[k][k] - a[i][k] * a[k][j]) / previous;
      previous = a[k][k];
    }
    const determinant = sign * a[13][13];
    expect(determinant % 2 !== 0 && determinant % 3 !== 0).toBe(true);
  });
});
