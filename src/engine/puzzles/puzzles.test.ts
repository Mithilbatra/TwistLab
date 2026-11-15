import { describe, expect, it } from 'vitest';
import { COMING_SOON, PUZZLES, type PuzzleId } from './index';
import { PUZZLE_CATEGORIES } from './PuzzleEngine';
import type { TwistMove, TwistPuzzle, TwistState } from './twistPuzzle';

const { pyraminx, skewb, megaminx, dino, redi, mirror, mirror2x2, fisher, barrel } = PUZZLES;
const twists: TwistPuzzle[] = [pyraminx, skewb, megaminx, dino, redi, mirror, mirror2x2, fisher, barrel];

/** Seeded PRNG (mulberry32), so a failing random case can be replayed from its seed. */
function seeded(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function moves(puzzle: TwistPuzzle, algorithm: string): TwistMove[] {
  const parsed = puzzle.parse(algorithm);
  if (!parsed.ok) throw new Error(`${algorithm}: ${parsed.error.message}`);
  return parsed.moves;
}

const play = (puzzle: TwistPuzzle, sequence: readonly TwistMove[], from = puzzle.createSolved()) =>
  sequence.reduce((state, move) => puzzle.apply(state, move), from);
const run = (puzzle: TwistPuzzle, algorithm: string) => play(puzzle, moves(puzzle, algorithm));
const undo = (puzzle: TwistPuzzle, sequence: readonly TwistMove[]) => sequence.map(puzzle.invert).reverse();

/** How many times an algorithm must be repeated before the puzzle is solved again. */
function order(puzzle: TwistPuzzle, algorithm: string): number {
  const sequence = moves(puzzle, algorithm);
  let state = play(puzzle, sequence);
  let count = 1;
  while (!puzzle.isSolved(state)) {
    state = play(puzzle, sequence, state);
    if (++count > 5000) throw new Error(`${algorithm} never returns to solved`);
  }
  return count;
}

const model = (puzzle: TwistPuzzle) => {
  if (puzzle.model.kind !== 'pieces') throw new Error('not drawn piece by piece');
  return puzzle.model;
};
/** How many pieces a turn carries. */
const carried = (puzzle: TwistPuzzle, move: string) =>
  model(puzzle).turning(puzzle.createSolved(), moves(puzzle, move)[0])[0].moving.filter(Boolean).length;
/** How many colours each piece shows, read off its mesh. Hidden pieces show none. */
const colours = (puzzle: TwistPuzzle) => model(puzzle).pieces.map((piece) => new Set(piece.tags.filter((tag) => tag >= 0)).size);
const piecesWith = (puzzle: TwistPuzzle, count: number) => colours(puzzle).flatMap((shown, i) => (shown === count ? [i] : []));
const tally = (puzzle: TwistPuzzle) => [0, 1, 2, 3].map((count) => piecesWith(puzzle, count).length);

/** Which face of a cube a piece sits in the middle of, whichever way round it sits there. */
function place(puzzle: TwistPuzzle, state: TwistState, piece: number): string {
  const { positions } = model(puzzle).pieces[piece];
  const rot = model(puzzle).pose(state, piece);
  const middle = [0, 1, 2].map((axis) => positions.filter((_, i) => i % 3 === axis).reduce((sum, v) => sum + v, 0));
  const now = [0, 1, 2].map((row) => rot[row * 3] * middle[0] + rot[row * 3 + 1] * middle[1] + rot[row * 3 + 2] * middle[2]);
  const axis = now.reduce((best, v, i) => (Math.abs(v) > Math.abs(now[best]) ? i : best), 0);
  return `${axis}${now[axis] > 0 ? '+' : '-'}`;
}

/**
 * How many arrangements of the watched pieces the given turns can reach, by trying them all.
 * By default an arrangement is where each piece is and how it is turned; `byPlace` counts only where.
 */
function reach(puzzle: TwistPuzzle, generators: string, watch: readonly number[], byPlace = false): number {
  const turns = moves(puzzle, generators);
  const keyOf = (state: TwistState) => watch.map((i) => (byPlace ? place(puzzle, state, i) : state[i])).join(';');
  const queue: TwistState[] = [puzzle.createSolved()];
  const seen = new Set([keyOf(queue[0])]);
  for (let head = 0; head < queue.length; head++)
    for (const turn of turns) {
      const next = puzzle.apply(queue[head], turn);
      if (!seen.has(keyOf(next))) {
        seen.add(keyOf(next));
        queue.push(next);
      }
    }
  return seen.size;
}

describe.each(twists)('$name: mechanics', (puzzle) => {
  const solved = puzzle.createSolved();
  const names = [...new Set(Array.from({ length: 12 }, (_, seed) => puzzle.scramble(seeded(seed + 1))).flat().map((m) => m.name))];

  it('starts solved and valid', () => {
    expect(puzzle.isSolved(solved)).toBe(true);
    expect(puzzle.validate(solved)).toEqual([]);
  });

  it('undoes every move with its inverse, and brings every move back round', () => {
    const start = play(puzzle, puzzle.scramble(seeded(99)));
    expect(names.length).toBeGreaterThan(2);
    for (const name of names) {
      const [move] = moves(puzzle, name);
      const turned = puzzle.apply(start, move);
      expect(turned, name).not.toEqual(start);
      expect(puzzle.apply(turned, puzzle.invert(move)), name).toEqual(start);
      let state = turned;
      let count = 1;
      while (count < 6 && state.some((rot, i) => rot !== start[i])) {
        state = puzzle.apply(state, move);
        count++;
      }
      expect(state, `${name} repeated`).toEqual(start);
    }
  });

  it('is solved again once a scramble is undone, thirty times over', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const scramble = puzzle.scramble(seeded(seed));
      const scrambled = play(puzzle, scramble);
      expect(puzzle.isSolved(scrambled), `seed ${seed}`).toBe(false);
      expect(puzzle.validate(scrambled), `seed ${seed}`).toEqual([]);
      const back = play(puzzle, undo(puzzle, scramble), scrambled);
      expect(back, `seed ${seed}`).toEqual(solved);
      expect(puzzle.isSolved(back)).toBe(true);
    }
  });

  it('reads back the notation it writes', () => {
    const scramble = puzzle.scramble(seeded(5));
    expect(moves(puzzle, scramble.map((move) => move.notation).join(' '))).toEqual(scramble);
    expect(moves(puzzle, undo(puzzle, scramble).map((move) => move.notation).join(' '))).toEqual(undo(puzzle, scramble));
  });

  it('stays valid through a long random walk', () => {
    let state = solved;
    for (let seed = 1; seed <= 40; seed++)
      for (const move of puzzle.scramble(seeded(seed))) {
        state = puzzle.apply(state, move);
        const problems = puzzle.validate(state);
        if (problems.length > 0) throw new Error(`invalid after ${move.notation}: ${problems.join('; ')}`);
      }
    expect(state).toHaveLength(solved.length);
  });

  it('has a mesh for every piece, and every colour of the shape on some piece', () => {
    const { pieces } = model(puzzle);
    expect(pieces).toHaveLength(solved.length);
    for (const piece of pieces) {
      expect(piece.positions.length).toBe(piece.tags.length * 3);
      expect(piece.positions.length % 9).toBe(0);
      expect(piece.positions.every(Number.isFinite)).toBe(true);
    }
    expect(pieces.some((piece) => piece.tags.some((tag) => tag >= 0))).toBe(true);
  });

  it('rejects what is not a move, without running any of it', () => {
    expect(puzzle.parse(`${names[0]} ?`)).toEqual({ ok: false, error: { message: expect.stringContaining('"?" is not a move'), index: names[0].length + 1 } });
    expect(puzzle.parse(`'${names[0]}`).ok).toBe(false);
    expect(puzzle.parse(`(${names[0]}`).ok).toBe(false);
    expect(puzzle.parse(`(${names[0]} ${names[1]})2`).ok).toBe(true);
  });
});

describe('Pyraminx', () => {
  it('is four tips, four centres under them, six edges and a hidden core', () => {
    expect(tally(pyraminx)).toEqual([1, 0, 6, 8]);
  });

  it('turns a tip alone, or a corner with the layer under it', () => {
    expect(carried(pyraminx, 'u')).toBe(1);
    expect(carried(pyraminx, 'U')).toBe(5); // tip, centre and three edges
    expect(order(pyraminx, 'U')).toBe(3);
    expect(order(pyraminx, 'u')).toBe(3);
    expect(run(pyraminx, "U2")).toEqual(run(pyraminx, "U'")); // two thirds one way is a third the other
    expect(run(pyraminx, 'u L')).toEqual(run(pyraminx, 'L u')); // a tip turns free of everything else
    expect(run(pyraminx, 'U L')).not.toEqual(run(pyraminx, 'L U'));
  });

  it('reaches exactly the arrangements a Pyraminx has', () => {
    // 6!/2 ways to place the edges, times 2^5 ways to flip them.
    expect(reach(pyraminx, 'U L R B', piecesWith(pyraminx, 2))).toBe(11_520);
    // Each tip turns three ways on its own, and so does each centre under it.
    expect(reach(pyraminx, 'u l r b', pyraminx.createSolved().map((_, i) => i))).toBe(81);
    const tips = [...'ulrb'].map((tip) => model(pyraminx).turning(pyraminx.createSolved(), moves(pyraminx, tip)[0])[0].moving.indexOf(true));
    expect(reach(pyraminx, 'U L R B', piecesWith(pyraminx, 3).filter((i) => !tips.includes(i)))).toBe(81);
  });

  it('scrambles with eleven corner turns, then the tips', () => {
    const scramble = pyraminx.scramble(seeded(4));
    expect(scramble.slice(0, 11).every((move) => 'ULRB'.includes(move.name))).toBe(true);
    expect(scramble.slice(11).every((move) => 'ulrb'.includes(move.name))).toBe(true);
    expect(scramble.length).toBeLessThanOrEqual(15);
  });
});

describe('Skewb', () => {
  it('is eight corners and six centres, and every turn carries half of them', () => {
    expect(tally(skewb)).toEqual([0, 6, 0, 8]);
    for (const move of 'RULB') expect(carried(skewb, move)).toBe(7); // four corners and three centres
    expect(order(skewb, 'R')).toBe(3);
  });

  it('reaches exactly the arrangements a Skewb has', () => {
    // 6!/2 places for the centres times 4!/2 × 3^6 for the corners: 3,149,280 positions in all.
    expect(reach(skewb, 'R U L B', piecesWith(skewb, 1), true)).toBe(360);
    expect(reach(skewb, 'R U L B', piecesWith(skewb, 3))).toBe(8_748);
    // The engine also tracks which way round each centre sits, which plain stickers do not show: 2^5 more.
    // That is the 100,776,960 of a Skewb with marked centres.
    expect(reach(skewb, 'R U L B', piecesWith(skewb, 1))).toBe(360 * 32);
  });
});

describe('Megaminx', () => {
  it('is twelve centres, thirty edges, twenty corners and a hidden core', () => {
    expect(tally(megaminx)).toEqual([1, 12, 30, 20]);
  });

  it('turns a face in fifths, with its five edges and five corners', () => {
    for (const face of ['U', 'F', 'R', 'L', 'BR', 'BL', 'DR', 'DL', 'DBR', 'DBL', 'B', 'D']) {
      expect(carried(megaminx, face), face).toBe(11);
      expect(order(megaminx, face), face).toBe(5);
    }
    expect(run(megaminx, 'U D')).toEqual(run(megaminx, 'D U')); // opposite faces do not meet
    expect(run(megaminx, 'R DBL')).toEqual(run(megaminx, 'DBL R'));
    expect(run(megaminx, 'U F')).not.toEqual(run(megaminx, 'F U'));
    expect(order(megaminx, "R U R' U'")).toBe(6); // two faces that share an edge behave as they do on a cube
  });

  it('writes two fifths as 2, and the wide turns of a scramble as ++ and --', () => {
    expect(moves(megaminx, "BR2' F3 U'").map((move) => [move.name, move.turns, move.notation])).toEqual([
      ['BR', -2, "BR2'"],
      ['F', -2, "F2'"], // three fifths one way is two the other
      ['U', -1, "U'"],
    ]);
    expect(megaminx.parse('F5')).toEqual({ ok: false, error: { message: expect.stringContaining('comes back round after 5'), index: 0 } });
    expect(carried(megaminx, 'R++')).toBe(52); // everything but the face opposite
    expect(run(megaminx, 'R++ R--')).toEqual(megaminx.createSolved());
    expect(megaminx.invert(moves(megaminx, 'D++')[0]).notation).toBe('D--');
    expect(order(megaminx, 'R++')).toBe(5);
  });

  it('scrambles in the competition format', () => {
    const scramble = megaminx.scramble(seeded(2)).map((move) => move.notation);
    expect(scramble).toHaveLength(77);
    for (let row = 0; row < 7; row++) {
      const line = scramble.slice(row * 11, row * 11 + 11);
      expect(line.slice(0, 10).every((move, i) => (i % 2 === 0 ? /^R(\+\+|--)$/ : /^D(\+\+|--)$/).test(move))).toBe(true);
      expect(line[10]).toMatch(/^U'?$/);
    }
  });
});

describe('Dino Cube', () => {
  it('is twelve edges that turn in threes', () => {
    expect(tally(dino)).toEqual([9, 0, 12, 0]);
    expect(model(dino).turning(dino.createSolved(), moves(dino, 'UFR')[0])[0].moving.filter((on, i) => on && colours(dino)[i] > 0)).toHaveLength(3);
    expect(order(dino, 'UFR')).toBe(3);
    expect(run(dino, 'UFR DBL')).toEqual(run(dino, 'DBL UFR')); // opposite corners share nothing
    expect(run(dino, 'UFR UFL')).not.toEqual(run(dino, 'UFL UFR'));
  });

  it('only ever permutes its edges evenly', () => {
    // Two corners that share an edge move five edges between them, in every even way and no odd one: 5!/2.
    expect(reach(dino, 'UFR UFL', piecesWith(dino, 2))).toBe(60);
  });
});

describe('Redi Cube', () => {
  it('is eight corners and twelve edges around a core that shows six fixed centres', () => {
    expect(tally(redi)).toEqual([0, 0, 12, 8]);
    expect(piecesWith(redi, 6)).toHaveLength(1);
  });

  it('turns a corner with its three edges, and never the centres', () => {
    const [core] = piecesWith(redi, 6);
    for (const corner of ['UFR', 'UFL', 'UBR', 'UBL', 'DFR', 'DFL', 'DBR', 'DBL']) {
      const [{ moving }] = model(redi).turning(redi.createSolved(), moves(redi, corner)[0]);
      expect(moving.filter(Boolean), corner).toHaveLength(4);
      expect(moving[core], corner).toBe(false);
    }
    expect(order(redi, 'UFR')).toBe(3);
    expect(run(redi, 'UFR DBL')).toEqual(run(redi, 'DBL UFR')); // opposite corners share nothing
    expect(run(redi, 'UFR UFL')).not.toEqual(run(redi, 'UFL UFR'));
  });

  it('only ever permutes its edges evenly, as the Dino Cube does', () => {
    expect(reach(redi, 'UFR UFL', piecesWith(redi, 2))).toBe(60);
  });
});

describe('shape mods', () => {
  it('turn like the cube inside them', () => {
    expect(tally(mirror)).toEqual([1, 26, 0, 0]); // a hidden core, and 26 pieces in the one colour
    expect(mirror.createSolved()).toHaveLength(27);
    expect(mirror2x2.createSolved()).toHaveLength(8);
    expect([carried(mirror, 'R'), carried(mirror, 'M'), carried(mirror, 'r'), carried(mirror, 'x')]).toEqual([9, 9, 18, 27]);
    for (const [a, b] of [['M', "x' L' R"], ['E', "y' D' U"], ['S', "z F' B"], ['r', "R M'"], ['Rw', 'r'], ['x', "R M' L'"]])
      expect(run(mirror, a), `${a} = ${b}`).toEqual(run(mirror, b));
    // The orders known for a 3×3 and a 2×2 hold, because every piece can be told from every other.
    expect(order(mirror, "R U R' U'")).toBe(6);
    expect(order(mirror, 'R U')).toBe(105);
    expect(order(mirror, "R U2 D' B D'")).toBe(1260);
    expect(order(barrel, 'R U')).toBe(105);
    expect(order(mirror2x2, 'R U')).toBe(15);
  });

  it('are solved by shape, however they are held', () => {
    for (const puzzle of [mirror, fisher, barrel]) {
      expect(puzzle.isSolved(run(puzzle, 'x y z2')), puzzle.name).toBe(true);
      expect(puzzle.isSolved(run(puzzle, 'R')), puzzle.name).toBe(false);
      expect(puzzle.isSolved(run(puzzle, 'R2')), puzzle.name).toBe(false);
      expect(puzzle.isSolved(run(puzzle, 'M2 E2 S2')), puzzle.name).toBe(false);
      // Ten turns of the top with everything else put back: its centre is square, so nothing shows.
      expect(puzzle.isSolved(run(puzzle, "(R U R' U)5")), puzzle.name).toBe(true);
    }
    expect(mirror2x2.isSolved(run(mirror2x2, 'x2 y'))).toBe(true);
    expect(mirror2x2.isSolved(run(mirror2x2, 'R2'))).toBe(false);
  });

  it('show a twisted centre exactly where its shape or colours give it away', () => {
    // The same ten turns of the right face leave its centre half a turn round and everything else in place.
    const twisted = "(U R U' R)5";
    expect(mirror.isSolved(run(mirror, twisted))).toBe(true); // a square block
    expect(barrel.isSolved(run(barrel, twisted))).toBe(true); // a square in one colour
    expect(fisher.isSolved(run(fisher, twisted))).toBe(false); // an edge of the cube, in two colours
    // So on a Fisher Cube a sequence must also bring that centre back round: four times as long as on a 3×3.
    expect(order(fisher, 'R U')).toBe(420);
  });

  it('hide a flipped edge on the barrel, where the upright edges are one flat colour', () => {
    // Flips the two edges on the right of the middle layer, in place.
    const flip = "z M' U M' U M' U2 M U M U M U2 z'";
    expect(barrel.isSolved(run(barrel, flip))).toBe(true);
    expect(mirror.isSolved(run(mirror, flip))).toBe(false);
    expect(fisher.isSolved(run(fisher, flip))).toBe(false);
  });
});

describe('dragging', () => {
  it('offers each piece the smallest turn that carries it, about each line it can turn on', () => {
    const grips = (puzzle: TwistPuzzle, piece: number) => model(puzzle).grips(puzzle.createSolved(), piece);
    expect(piecesWith(megaminx, 1).map((i) => grips(megaminx, i).length)).toEqual(Array(12).fill(1));
    expect(piecesWith(megaminx, 2).map((i) => grips(megaminx, i).length)).toEqual(Array(30).fill(2));
    expect(piecesWith(megaminx, 3).map((i) => grips(megaminx, i).length)).toEqual(Array(20).fill(3));
    expect(piecesWith(mirror, 1).map((i) => grips(mirror, i).length)).toEqual(Array(26).fill(3));
    // A Pyraminx tip is dragged on its own: the tip turn, not the corner turn that would also carry it.
    const tip = model(pyraminx).turning(pyraminx.createSolved(), moves(pyraminx, 'u')[0])[0].moving.indexOf(true);
    expect(grips(pyraminx, tip).map((grip) => grip.turn(-1).notation)).toEqual(['u']);
    expect(grips(pyraminx, tip)[0].turn(1).notation).toBe("u'");
  });
});

describe('the library', () => {
  const ids = Object.keys(PUZZLES) as PuzzleId[];

  it('describes every playable puzzle', () => {
    for (const id of ids) {
      const puzzle = PUZZLES[id];
      expect(puzzle.id).toBe(id);
      expect(PUZZLE_CATEGORIES).toContain(puzzle.category);
      expect(puzzle.difficulty).toBeGreaterThanOrEqual(1);
      expect(puzzle.difficulty).toBeLessThanOrEqual(5);
      for (const text of [puzzle.name, puzzle.label, puzzle.summary, puzzle.help]) expect(text.length).toBeGreaterThan(2);
      expect(puzzle.isSolved(puzzle.createSolved() as never)).toBe(true);
    }
  });

  it('lists twenty-five puzzles, each either playable or coming soon, never both', () => {
    const playable = ids.map((id) => PUZZLES[id].name);
    const planned = COMING_SOON.map((puzzle) => puzzle.name);
    expect(new Set([...playable, ...planned]).size).toBe(playable.length + planned.length);
    expect(playable.length + planned.length).toBe(25);
    for (const puzzle of COMING_SOON) expect(PUZZLE_CATEGORIES).toContain(puzzle.category);
    for (const category of PUZZLE_CATEGORIES)
      expect([...ids.map((id) => PUZZLES[id].category), ...COMING_SOON.map((p) => p.category)]).toContain(category);
  });
});
