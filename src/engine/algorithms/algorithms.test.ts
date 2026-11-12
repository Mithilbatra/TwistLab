import { describe, expect, it } from 'vitest';
import { applyMoves, centreFrame, type CubeState, type Cubie } from '../core/CubeState';
import { sameValues } from '../core/math';
import { PUZZLES } from '../puzzles';
import { ALGORITHMS, CATEGORIES } from './AlgorithmLibrary';
import { demoSetup, HOLD, laterPieces, lessonDone, LESSONS, parse3x3, practiceSetup, stageOf } from './lessons';

const cube = PUZZLES['3x3'];
const solved = cube.createSolved();
const apply = (algorithm: string, from: CubeState = solved) => applyMoves(from, parse3x3(algorithm));

function seeded(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The checks below run on a cube held white-up, where the last layer is the +y layer.
// "Solved" and "oriented" are relative to the centres, so algorithms with rotations still count.
const isSolvedPiece = (state: CubeState) => {
  const frame = centreFrame(state, 3);
  return (cubie: Cubie) => sameValues(cubie.rot, frame);
};
const isOrientedPiece = (state: CubeState) => {
  const frame = centreFrame(state, 3);
  return (cubie: Cubie) => [1, 4, 7].every((i) => cubie.rot[i] === frame[i]);
};
const lastLayer = (state: CubeState) => state.filter((c) => c.home[1] === 2);
// Centres are left out: an algorithm may twist one in place, which no sticker shows.
const firstTwoLayers = (state: CubeState) => state.filter((c) => c.home[1] < 2 && stageOf(c.home) > 0);
const home = (state: CubeState, key: string) => state.find((c) => c.home.join() === key)!;
const at = (state: CubeState, key: string) => state.find((c) => c.pos.join() === key)!;
const inCategory = (category: string) => ALGORITHMS.filter((a) => a.categories[0] === category);

describe('algorithm library', () => {
  it('has unique ids, known categories and parseable notation', () => {
    expect(new Set(ALGORITHMS.map((a) => a.id)).size).toBe(ALGORITHMS.length);
    for (const algorithm of ALGORITHMS) {
      expect(algorithm.categories.length, algorithm.id).toBeGreaterThan(0);
      for (const category of algorithm.categories) expect(CATEGORIES, algorithm.id).toContain(category);
      expect(cube.parse(algorithm.notation).ok, algorithm.id).toBe(true);
    }
    for (const category of CATEGORIES)
      expect(ALGORITHMS.some((a) => a.categories.includes(category)), category).toBe(true);
  });

  it.each(inCategory('OLL'))('$name ($notation) keeps the first two layers and changes orientation', ({ notation }) => {
    const state = apply(notation);
    expect(firstTwoLayers(state).every(isSolvedPiece(state))).toBe(true);
    expect(lastLayer(state).every(isOrientedPiece(state))).toBe(false);
  });

  it.each(inCategory('PLL'))('$name ($notation) only permutes the last layer', ({ notation }) => {
    const state = apply(notation);
    expect(firstTwoLayers(state).every(isSolvedPiece(state))).toBe(true);
    expect(lastLayer(state).every(isOrientedPiece(state))).toBe(true);
    // A real permutation: no turn of the top layer alone undoes it.
    for (const fix of ['', 'U', 'U2', "U'"]) expect(cube.isSolved(apply(fix, state)), `fixed by "${fix}"`).toBe(false);
  });

  it('gives every PLL a distinct effect', () => {
    const effects = inCategory('PLL').map(({ notation }) => {
      const state = apply(notation);
      // Compare up to the turn of the top layer the algorithm happens to end on.
      return ['', 'U', 'U2', "U'"].map((fix) => JSON.stringify(lastLayer(apply(fix, state)).map((c) => c.pos))).sort()[0];
    });
    expect(inCategory('PLL')).toHaveLength(21);
    expect(new Set(effects).size).toBe(21);
  });

  it.each(inCategory('F2L'))('$name ($notation) touches only the front-right slot and the top layer', ({ notation }) => {
    const state = apply(notation);
    const slot = ['2,-2,2', '2,0,2']; // the front-right corner and edge, on a cube held white-up
    const solvedPiece = isSolvedPiece(state);
    expect(firstTwoLayers(state).filter((c) => !slot.includes(c.home.join())).every(solvedPiece)).toBe(true);
    expect(slot.every((key) => solvedPiece(home(state, key)))).toBe(false);
  });

  it.each(inCategory('Cross'))('$name ($notation) changes the front cross edge and no other', ({ notation }) => {
    const state = apply(notation);
    const solvedPiece = isSolvedPiece(state);
    expect(['2,-2,0', '-2,-2,0', '0,-2,-2'].every((key) => solvedPiece(home(state, key)))).toBe(true);
    expect(solvedPiece(home(state, '0,-2,2'))).toBe(false);
  });
});

describe('lessons', () => {
  const held = applyMoves(solved, HOLD);

  it('colours exactly the pieces solved so far', () => {
    expect(LESSONS.map((lesson) => solved.length - laterPieces(lesson).size)).toEqual([10, 14, 18, 22, 22, 26, 26]);
    expect(solved.filter((c) => stageOf(c.home) === 0)).toHaveLength(6);
  });

  it.each(LESSONS.flatMap((lesson) => lesson.cases.map((c) => ({ lesson, ...c }))))(
    '$lesson.title: "$name" ($algorithm) takes its case to the goal',
    ({ lesson, algorithm }) => {
      const moves = parse3x3(algorithm);
      const start = applyMoves(solved, demoSetup(moves));
      expect(lessonDone(lesson, start)).toBe(false);
      for (const earlier of LESSONS.slice(0, LESSONS.indexOf(lesson)))
        if (earlier.stage < lesson.stage) expect(lessonDone(earlier, start), earlier.title).toBe(true);
      expect(lessonDone(lesson, applyMoves(start, moves))).toBe(true);
    },
  );

  it('builds practice positions with earlier stages solved and this one open', () => {
    for (const lesson of LESSONS)
      for (let seed = 1; seed <= 40; seed++) {
        const state = applyMoves(solved, practiceSetup(lesson, seeded(seed)));
        const label = `${lesson.title}, seed ${seed}`;
        expect(cube.validate(state), label).toEqual([]);
        expect(lessonDone(lesson, state), label).toBe(false);
        for (const earlier of LESSONS)
          if (earlier.stage < lesson.stage) expect(lessonDone(earlier, state), label).toBe(true);
      }
  });

  it('recognises a finished stage however the cube is held', () => {
    const last = LESSONS[LESSONS.length - 1];
    expect(lessonDone(last, apply('x y2 z'))).toBe(true);
    expect(lessonDone(last, apply("x y2 z R U R' U'"))).toBe(false);
    // After x the yellow layer faces front. Turning it leaves everything up to the yellow cross intact.
    const yellowTurned = apply('x F2');
    expect(LESSONS.map((lesson) => lessonDone(lesson, yellowTurned))).toEqual([true, true, true, true, false, false, false]);
  });

  // The instructions name specific situations. These pin each claim to the position the demo really shows.
  it('white corners: one, three and five rounds match white facing right, up and front', () => {
    const facing = ['1,0,0', '0,1,0', '0,0,1'];
    LESSONS[1].cases.forEach(({ algorithm }, i) => {
      const corner = at(applyMoves(solved, demoSetup(parse3x3(algorithm))), '2,2,2');
      expect(corner.home).toEqual([-2, 2, 2]); // the piece that belongs in the front-right slot below it
      expect([corner.rot[1], corner.rot[4], corner.rot[7]].join(), algorithm).toBe(facing[i]); // its white sticker
    });
  });

  it('middle layer: the edge starts at the top front and ends in the named slot', () => {
    const [right, left] = LESSONS[2].cases.map(({ algorithm }) => applyMoves(solved, demoSetup(parse3x3(algorithm))));
    expect(at(right, '0,2,2').home).toEqual(at(held, '2,0,2').home);
    expect(at(left, '0,2,2').home).toEqual(at(held, '-2,0,2').home);
  });

  it('yellow cross: the line lies left to right and the L sits back-left', () => {
    const yellowUp = (state: CubeState) =>
      ['0,2,2', '2,2,0', '0,2,-2', '-2,2,0'].filter((key) => isOrientedPiece(state)(at(state, key)));
    const [line, l] = LESSONS[3].cases.map(({ algorithm }) => applyMoves(solved, demoSetup(parse3x3(algorithm))));
    expect(yellowUp(line)).toEqual(['2,2,0', '-2,2,0']);
    expect(yellowUp(l)).toEqual(['0,2,-2', '-2,2,0']);
  });

  it('yellow edges: swaps front and left, keeps back and right', () => {
    const state = apply(LESSONS[4].cases[0].algorithm, held);
    expect(at(state, '0,2,-2')).toEqual(at(held, '0,2,-2'));
    expect(at(state, '2,2,0')).toEqual(at(held, '2,2,0'));
    expect(at(state, '0,2,2').home).toEqual(at(held, '-2,2,0').home);
    expect(at(state, '-2,2,0').home).toEqual(at(held, '0,2,2').home);
  });

  it('yellow corners: the front-right corner stays, the other three cycle', () => {
    const state = apply(LESSONS[5].cases[0].algorithm, held);
    expect(at(state, '2,2,2').home).toEqual(at(held, '2,2,2').home);
    for (const key of ['-2,2,2', '2,2,-2', '-2,2,-2']) expect(at(state, key).home).not.toEqual(at(held, key).home);
    expect(lessonDone(LESSONS[4], state)).toBe(true); // edges untouched
  });

  it('twist corners: only the front-right and back-right corners change, and only their twist', () => {
    const state = apply(LESSONS[6].cases[0].algorithm, held);
    const changed = state.filter((c, i) => c !== held[i] && !sameValues(c.rot, held[i].rot));
    expect(changed.map((c) => c.pos.join()).sort()).toEqual(['2,2,-2', '2,2,2']);
    expect(state.every((c, i) => sameValues(c.pos, held[i].pos))).toBe(true);
  });
});
