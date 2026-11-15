import { describe, expect, it } from 'vitest';
import { PUZZLES } from './index';
import { SLASH, slashable, turn, type Square1Move, type Square1State } from './square1';

const sq1 = PUZZLES.square1;
const solved = sq1.createSolved();

/** Seeded PRNG (mulberry32), so a failing random case can be replayed from its seed. */
function seeded(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function moves(algorithm: string): Square1Move[] {
  const parsed = sq1.parse(algorithm);
  if (!parsed.ok) throw new Error(`${algorithm}: ${parsed.error.message}`);
  return parsed.moves;
}
/** Plays moves as the app does: a move the puzzle refuses is a failure, never silently made. */
const play = (sequence: readonly Square1Move[], from: Square1State = solved) =>
  sequence.reduce((state, move) => {
    const why = sq1.blocked!(state, move);
    if (why) throw new Error(`${move.notation}: ${why}`);
    return sq1.apply(state, move);
  }, from);
const run = (algorithm: string) => play(moves(algorithm));
const undo = (sequence: readonly Square1Move[]) => sequence.map(sq1.invert).reverse();

describe('Square-1 notation', () => {
  it('reads WCA notation, with or without brackets, and writes it back', () => {
    expect(moves('(1,0) / (-1,-1)/( 0 , 3 ) /').map((move) => move.notation)).toEqual(['(1,0)', '/', '(-1,-1)', '/', '(0,3)', '/']);
    expect(moves('1,0/-1,-1/')).toEqual(moves('(1,0)/(-1,-1)/'));
    expect(moves('(-6,6)')[0].notation).toBe('(6,6)'); // half a turn either way is written as 6
    const scramble = sq1.scramble(seeded(5));
    expect(moves(scramble.map((move) => move.notation).join(' '))).toEqual(scramble);
  });

  it('rejects what is not a move, saying where, and runs none of it', () => {
    const error = (algorithm: string) => {
      const parsed = sq1.parse(algorithm);
      return parsed.ok ? null : parsed.error;
    };
    expect(error('(1,0)/ R')).toEqual({ message: expect.stringContaining('"R" is not a move on a Square-1'), index: 7 });
    expect(error('(1,0')).toEqual({ message: 'This "(" is never closed', index: 0 });
    expect(error(')')).toEqual({ message: 'This ")" has no matching "("', index: 0 });
    expect(error('(1;0)')).toEqual({ message: expect.stringContaining('(top,bottom)'), index: 0 });
    expect(error('(7,0)')).toEqual({ message: expect.stringContaining('turns too far'), index: 1 });
    expect(error('/ (0,0)')).toEqual({ message: 'This turn moves nothing', index: 2 });
  });
});

describe('Square-1 mechanics', () => {
  it('starts solved, in the layout the WCA scrambler uses', () => {
    expect(sq1.isSolved(solved)).toBe(true);
    expect(sq1.validate(solved)).toEqual([]);
    expect(slashable(solved)).toBe(true);
  });

  it('blocks the slash exactly when a corner lies across the cut', () => {
    // From cube shape, WCA scrambles open with turns like (1,0) and (0,-1): they leave the cut clear, while a
    // twelfth the other way puts a corner across it.
    for (const clear of ['(1,0)', '(0,-1)', '(3,0)', '(0,3)', '(1,-1)', '(-2,0)', '(6,6)'])
      expect(sq1.blocked!(run(clear), SLASH), clear).toBeNull();
    for (const jammed of ['(-1,0)', '(0,1)', '(2,0)', '(1,1)'])
      expect(sq1.blocked!(run(jammed), SLASH), jammed).toMatch(/across the slash/);
    expect(sq1.blocked!(run('(-1,0)'), turn(1, 0))).toBeNull(); // the layers themselves always turn
  });

  it('brings a layer back after twelve twelfths, and the slash after two', () => {
    expect(run('(1,0)'.repeat(12))).toEqual(solved);
    expect(run('(0,-1)'.repeat(12))).toEqual(solved);
    expect(run('//')).toEqual(solved);
    expect(sq1.isSolved(run('/'))).toBe(false);
    expect(run('/').middle).toBe(1);
    expect(run('(1,0)')).not.toEqual(solved);
  });

  it('undoes every scramble, and every scramble only slashes where it can', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const scramble = sq1.scramble(seeded(seed));
      const scrambled = play(scramble); // throws if a slash is blocked
      expect(scramble.filter((move) => move.kind === 'slash'), `seed ${seed}`).toHaveLength(12);
      expect(sq1.isSolved(scrambled), `seed ${seed}`).toBe(false);
      expect(sq1.validate(scrambled), `seed ${seed}`).toEqual([]);
      expect(play(undo(scramble), scrambled), `seed ${seed}`).toEqual(solved);
    }
  });

  it('reaches all 170 shapes a Square-1 is known to take', () => {
    // A ring's shape is its cycle of corners and edges, however it is turned: each slot is the first half of a
    // corner, the second half, or an edge, and the smallest rotation of that string names the cycle.
    const ringShape = (ring: readonly number[]) => {
      const slots = ring.map((id, k) => (ring[(k + 1) % 12] === id ? 'a' : ring[(k + 11) % 12] === id ? 'b' : 'e')).join('');
      return Array.from({ length: 12 }, (_, k) => slots.slice(k) + slots.slice(0, k)).sort()[0];
    };
    const shape = (s: Square1State) => `${ringShape(s.top)}|${ringShape(s.bottom)}`;
    // Turning a layer never changes its shape, so one position stands for every position of its shape:
    // from it, every turn that clears the cut, then the slash, leads to the next shapes.
    const turns = Array.from({ length: 144 }, (_, k) => turn((k % 12) - 5, Math.floor(k / 12) - 5));
    const found = new Map([[shape(solved), solved]]);
    const queue = [solved];
    for (let head = 0; head < queue.length; head++)
      for (const t of turns) {
        const turned = sq1.apply(queue[head], t);
        if (!slashable(turned)) continue;
        const next = sq1.apply(turned, SLASH);
        if (!found.has(shape(next))) {
          found.set(shape(next), next);
          queue.push(next);
        }
      }
    expect(found.size).toBe(170);
  });
});

describe('Square-1 model', () => {
  const model = sq1.model;
  if (model.kind !== 'pieces') throw new Error('the Square-1 is drawn piece by piece');

  it('draws every piece in the slots the state puts it in', () => {
    for (const state of [solved, play(sq1.scramble(seeded(3))), play(sq1.scramble(seeded(8)))])
      model.pieces.slice(0, 16).forEach((mesh, i) => {
        const corners = mesh.positions.length / 3;
        const middle = [0, 1, 2].map((axis) => mesh.positions.filter((_, k) => k % 3 === axis).reduce((a, b) => a + b, 0) / corners);
        const r = model.pose(state, i);
        const [x, y, z] = [0, 1, 2].map((row) => r[row * 3] * middle[0] + r[row * 3 + 1] * middle[1] + r[row * 3 + 2] * middle[2]);
        const layer = state.top.includes(i) ? 'top' : 'bottom';
        expect(Math.sign(y), `piece ${i}`).toBe(layer === 'top' ? 1 : -1);
        // Top slot k is centred on 120 + 30k degrees, clockwise from the right seen from above; the bottom's run back.
        const angle = ((Math.atan2(z, x) * 180) / Math.PI + 360) % 360;
        const centres = state[layer].flatMap((id, k) => (id === i ? [layer === 'top' ? 120 + 30 * k : 90 - 30 * k] : []));
        const off = Math.min(...centres.map((centre) => Math.abs(((angle - centre + 540) % 360) - 180)));
        expect(off, `piece ${i}`).toBeLessThanOrEqual(16);
      });
  });

  it('turns the right layers together, and offers only the turns a piece can make', () => {
    expect(model.turning(solved, turn(1, -1))).toHaveLength(2); // both layers at once
    const [slash] = model.turning(solved, SLASH);
    expect(slash.moving.filter(Boolean)).toHaveLength(9); // four pieces from each layer, and half the middle
    const topRight = solved.top[8]; // the right edge
    expect(model.grips(solved, topRight)).toHaveLength(2); // its layer, and the slash
    expect(model.grips(run('(-1,0)'), topRight)).toHaveLength(1); // the slash is blocked
    expect(model.grips(solved, 16)).toHaveLength(0); // the left half of the middle never moves
  });
});
