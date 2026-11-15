import type { V3 } from '../core/geometry';
import { CLOCK } from './clock';
import { createCubePuzzle } from './cubePuzzle';
import type { Puzzle, PuzzleInfo } from './PuzzleEngine';
import { SQUARE1 } from './square1';
import { createTwistPuzzle, type TwistDef } from './twistPuzzle';

/** Sticker colours by number. The first six are a cube's, in the engine's face order: right, left, up, down, front, back. */
export const STICKERS = [
  '#d8222f', '#f7791a', '#f2f3f5', '#f8d313', '#17a34f', '#1d5bdc',
  '#8b3fd9', '#f472b6', '#9bd94a', '#38c7e8', '#8d939e', '#f3e3b0', '#e3b23c', '#c7ccd6',
] as const;
const [RED, ORANGE, WHITE, YELLOW, GREEN, BLUE, PURPLE, PINK, LIME, CYAN, GREY, CREAM, GOLD, SILVER] = STICKERS.keys();

const SIDES: readonly V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** A box whose six faces lie the given distances from the centre, coloured in face order. */
const box = (reach: readonly number[], colours: readonly number[] = [RED, ORANGE, WHITE, YELLOW, GREEN, BLUE]) =>
  SIDES.map((n, i) => ({ n, d: reach[i], colour: colours[i] }));

/**
 * The turns of a cube mechanism: a 3×3 whose layers meet `half` either side of the
 * centre, or a 2×2 when `half` is 0. The frame says which way its right, up and
 * front point, which need not be the way the outer shape faces.
 */
function mechanism(half: number, right: V3 = SIDES[0], up: V3 = SIDES[2], front: V3 = SIDES[4]) {
  const back = (v: V3): V3 => [-v[0], -v[1], -v[2]];
  const axes = [right, back(right), up, back(up), front, back(front)].map((dir) => ({ dir, order: 4 }));
  const moves: Record<string, { axis: number; lo?: number; hi?: number }> = {};
  [...'RLUDFB'].forEach((face, axis) => {
    moves[face] = { axis, lo: half };
    // A wide turn takes the middle layer too. Both spellings are moves: r and Rw.
    if (half > 0) moves[face.toLowerCase()] = moves[`${face}w`] = { axis, lo: -half };
  });
  // The slices follow L, D and F.
  if (half > 0) Object.assign(moves, { M: { axis: 1, lo: -half, hi: half }, E: { axis: 3, lo: -half, hi: half }, S: { axis: 4, lo: -half, hi: half } });
  Object.assign(moves, { x: { axis: 0 }, y: { axis: 2 }, z: { axis: 4 } });
  return { axes, moves, rotations: ['x', 'y', 'z'] };
}

const CUBE_HELP = "Written like a 3×3: faces R L U D F B, slices M E S, wide r, rotations x y z. Add ' to reverse and 2 to double.";
const CUBE_SCRAMBLE = { from: [...'RLUDFB'], length: 20 };

// A tetrahedron with a corner on top: U, then L and R at the front of the base, and B behind.
const TETRA: readonly V3[] = [
  [0, 1, 0],
  [-Math.sqrt(2 / 3), -1 / 3, Math.SQRT2 / 3],
  [Math.sqrt(2 / 3), -1 / 3, Math.SQRT2 / 3],
  [0, -1 / 3, (-2 * Math.SQRT2) / 3],
];

const PYRAMINX: TwistDef = {
  id: 'pyraminx',
  name: 'Pyraminx',
  label: 'Pyraminx',
  category: 'WCA Puzzles',
  difficulty: 1,
  summary: 'A tetrahedron that turns about its four corners, a third of a turn at a time.',
  help: "Corners U L R B turn two layers; lowercase u l r b turn only the tip. Add ' to turn the other way.",
  moveNames: { U: 'Top corner', L: 'Left corner', R: 'Right corner', B: 'Back corner' },
  // Each face lies opposite a corner: yellow underneath, green in front.
  shell: TETRA.map((corner, i) => ({ n: [-corner[0], -corner[1], -corner[2]], d: 1 / 3, colour: [YELLOW, RED, BLUE, GREEN][i] })),
  axes: TETRA.map((dir) => ({ dir, order: 3 })),
  // The edges of a face are cut in thirds. Measured from the centre towards a corner, that is 5/9 and 1/9 of the way.
  moves: Object.fromEntries([...'ULRB'].flatMap((name, axis) => [[name, { axis, lo: 1 / 9 }], [name.toLowerCase(), { axis, lo: 5 / 9 }]])),
  scramble: { from: [...'ULRB'], length: 11, then: [...'ulrb'] },
};

const SKEWB: TwistDef = {
  id: 'skewb',
  name: 'Skewb',
  label: 'Skewb',
  category: 'WCA Puzzles',
  difficulty: 2,
  summary: 'A cube cut through its centre along four planes. Every turn carries half the puzzle.',
  help: "Four corners turn: R, U, L and B, each a third of a turn. Add ' to turn the other way.",
  moveNames: { R: 'Right-back corner', U: 'Top-back corner', L: 'Left-front corner', B: 'Back corner' },
  shell: box([1, 1, 1, 1, 1, 1]),
  // Held with the top, front and right faces in view: R is the far right corner, U the far top one,
  // L the far left one, and B the corner out of sight at the back.
  axes: ([[1, -1, -1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1]] as V3[]).map((dir) => ({ dir, order: 3 })),
  moves: Object.fromEntries([...'RULB'].map((name, axis) => [name, { axis, lo: 0 }])),
  scramble: { from: [...'RULB'], length: 11 },
};

// The twelve faces of a dodecahedron: one on top, a ring of five tilted up, a ring of five tilted down, one underneath.
const ring = (height: number, turn: number): V3[] =>
  Array.from({ length: 5 }, (_, k) => {
    const angle = ((90 + turn - 72 * k) * Math.PI) / 180;
    return [(2 * Math.cos(angle)) / Math.sqrt(5), height / Math.sqrt(5), (2 * Math.sin(angle)) / Math.sqrt(5)];
  });
const MEGAMINX_FACES: readonly (readonly [string, V3, number])[] = [
  ['U', [0, 1, 0], WHITE],
  ...ring(1, 0).map((n, k): [string, V3, number] => [['F', 'R', 'BR', 'BL', 'L'][k], n, [GREEN, RED, BLUE, YELLOW, PURPLE][k]]),
  ...ring(-1, -36).map((n, k): [string, V3, number] => [['DR', 'DBR', 'B', 'DBL', 'DL'][k], n, [PINK, CYAN, CREAM, LIME, ORANGE][k]]),
  ['D', [0, -1, 0], GREY],
];
// How far from the centre each face is cut. It leaves the corners, edges and centre of a face about a third of its width each.
const MEGAMINX_CUT = 0.74;

const MEGAMINX: TwistDef = {
  id: 'megaminx',
  name: 'Megaminx',
  label: 'Megaminx',
  category: 'WCA Puzzles',
  difficulty: 3,
  summary: 'Twelve faces that turn in fifths: a 3×3 stretched over a dodecahedron, with fifty moving pieces.',
  help: "Faces U F R L BR BL DR DL DBR DBL B D. Add ' to turn the other way and 2 for two steps. R++ and D-- are the wide turns scrambles use.",
  shell: MEGAMINX_FACES.map(([, n, colour]) => ({ n, d: 1, colour })),
  axes: MEGAMINX_FACES.map(([, dir]) => ({ dir, order: 5 })),
  moves: {
    ...Object.fromEntries(MEGAMINX_FACES.map(([name], axis) => [name, { axis, lo: MEGAMINX_CUT }])),
    // Everything except the face opposite: what R++ and D++ turn.
    Rw: { axis: 2, lo: -MEGAMINX_CUT },
    Dw: { axis: 11, lo: -MEGAMINX_CUT },
  },
  words: { 'R++': ['Rw', 2], 'R--': ['Rw', -2], 'D++': ['Dw', 2], 'D--': ['Dw', -2] },
  // The competition format: seven rows of ten wide turns, each row closed with a turn of the top.
  scramble: (random, move) =>
    Array.from({ length: 7 }, () => [
      ...Array.from({ length: 10 }, (_, k) => move(k % 2 === 0 ? 'Rw' : 'Dw', random() < 0.5 ? 2 : -2)),
      move('U', random() < 0.5 ? 1 : -1),
    ]).flat(),
};

const CORNERS: readonly V3[] = [1, -1].flatMap((y) => [1, -1].flatMap((z) => [1, -1].map((x): V3 => [x, y, z])));
const cornerName = ([x, y, z]: V3) => (y > 0 ? 'U' : 'D') + (z > 0 ? 'F' : 'B') + (x > 0 ? 'R' : 'L');

const DINO: TwistDef = {
  id: 'dino',
  name: 'Dino Cube',
  label: 'Dino',
  category: 'Advanced Puzzles',
  difficulty: 1,
  summary: 'Twelve edges and nothing else. Each corner turns the three edges that meet at it.',
  help: "Corners are named by their three faces: UFR, UFL, UBR, UBL, DFR, DFL, DBR, DBL. Add ' to turn the other way.",
  shell: box([1, 1, 1, 1, 1, 1]),
  axes: CORNERS.map((dir) => ({ dir, order: 3 })),
  // Each cut runs through the three corners next to its own, so it crosses every face on a diagonal.
  moves: Object.fromEntries(CORNERS.map((corner, axis) => [cornerName(corner), { axis, lo: 1 / Math.sqrt(3) }])),
  scramble: { from: CORNERS.map(cornerName), length: 14 },
};

const REDI: TwistDef = {
  id: 'redi',
  name: 'Redi Cube',
  label: 'Redi',
  category: 'Advanced Puzzles',
  difficulty: 2,
  summary: 'Eight corners turn in thirds, each taking its three edges along. The diamond centres never move.',
  help: DINO.help,
  shell: box([1, 1, 1, 1, 1, 1]),
  axes: CORNERS.map((dir) => ({ dir, order: 3 })),
  // The same corners as a Dino, cut shallower: each cut stops short of the face centres, which stay as fixed diamonds.
  moves: Object.fromEntries(CORNERS.map((corner, axis) => [cornerName(corner), { axis, lo: Math.sqrt(3) / 2 }])),
  scramble: { from: CORNERS.map(cornerName), length: 20 },
};

const MIRROR: TwistDef = {
  id: 'mirror',
  name: 'Mirror Cube',
  label: 'Mirror',
  category: 'Shape Mods',
  difficulty: 3,
  summary: 'A 3×3 in one colour whose pieces are all different sizes. It is solved when it is a box again.',
  help: CUBE_HELP,
  // A regular 3×3 mechanism set off-centre in its box, as in the original: layers 9, 19 and 29 mm thick one way,
  // 13, 19 and 25 the next, 17, 19 and 21 the third. Here the middle layer is 1 thick.
  shell: box([1.184, 1.816, 0.974, 2.026, 1.605, 1.395], Array(6).fill(GOLD)),
  ...mechanism(0.5),
  solvedBy: 'shape',
  scramble: CUBE_SCRAMBLE,
};

const MIRROR_2X2: TwistDef = {
  id: 'mirror2x2',
  name: 'Mirror 2×2',
  label: 'Mirror 2×2',
  category: 'Shape Mods',
  difficulty: 2,
  summary: 'Eight blocks, no two the same size, around a 2×2 mechanism. Solved by shape.',
  help: "Written like a 2×2: faces R L U D F B and rotations x y z. Add ' to reverse and 2 to double.",
  shell: box([1.25, 0.75, 0.8, 1.2, 1.1, 0.9], Array(6).fill(SILVER)),
  ...mechanism(0),
  solvedBy: 'shape',
  scramble: { from: [...'RUF'], length: 10 },
};

const FISHER: TwistDef = {
  id: 'fisher',
  name: 'Fisher Cube',
  label: 'Fisher',
  category: 'Shape Mods',
  difficulty: 3,
  summary: 'A 3×3 whose mechanism sits at 45° inside the cube, so its upright edges turn like faces.',
  help: `${CUBE_HELP} F is the upright edge facing you.`,
  shell: box([1.5, 1.5, 1.5, 1.5, 1.5, 1.5]),
  // The mechanism's front points along the cube's front-right edge, and its right along the back-right one.
  ...mechanism(0.5, [1, 0, -1], [0, 1, 0], [1, 0, 1]),
  solvedBy: 'shape',
  scramble: CUBE_SCRAMBLE,
};

const BARREL: TwistDef = {
  id: 'barrel',
  name: 'Barrel Cube',
  label: 'Barrel',
  category: 'Shape Mods',
  difficulty: 3,
  summary: 'A 3×3 with its four upright edges sliced away, leaving an eight-sided barrel in ten colours.',
  help: CUBE_HELP,
  shell: [
    ...box([1.5, 1.5, 1.5, 1.5, 1.5, 1.5]),
    // Each slice runs from one cut of the mechanism to the next, so an upright edge piece keeps a single face.
    ...([[1, 0, 1], [1, 0, -1], [-1, 0, -1], [-1, 0, 1]] as V3[]).map((n, i) => ({ n, d: 2, colour: [PURPLE, PINK, LIME, CYAN][i] })),
  ],
  ...mechanism(0.5),
  solvedBy: 'shape',
  scramble: CUBE_SCRAMBLE,
};

/** Puzzles with tested mechanics and a 3D model. Add an entry here to make a puzzle selectable. */
export const PUZZLES = {
  '2x2': createCubePuzzle(2, { name: '2×2 Pocket Cube', difficulty: 1, summary: 'Eight corners and nothing else. 3.6 million positions.' }),
  '3x3': createCubePuzzle(3, { name: "3×3 Rubik's Cube", difficulty: 2, summary: 'The original. 26 cubies, 43 quintillion positions.' }),
  '4x4': createCubePuzzle(4, { name: "4×4 Rubik's Revenge", difficulty: 3, summary: 'No fixed centres to steer by, and parity cases a 3×3 never has.' }),
  '5x5': createCubePuzzle(5, { name: "5×5 Professor's Cube", difficulty: 4, summary: 'Fixed centres return, with three kinds of edge around them.' }),
  '6x6': createCubePuzzle(6, { name: '6×6 Cube', difficulty: 4, summary: '152 cubies and, like the 4×4, no fixed centres.' }),
  '7x7': createCubePuzzle(7, { name: '7×7 Cube', difficulty: 5, summary: '218 cubies. The largest cube solved in competition.' }),
  pyraminx: createTwistPuzzle(PYRAMINX),
  skewb: createTwistPuzzle(SKEWB),
  megaminx: createTwistPuzzle(MEGAMINX),
  square1: SQUARE1,
  clock: CLOCK,
  mirror: createTwistPuzzle(MIRROR),
  mirror2x2: createTwistPuzzle(MIRROR_2X2),
  fisher: createTwistPuzzle(FISHER),
  barrel: createTwistPuzzle(BARREL),
  dino: createTwistPuzzle(DINO),
  redi: createTwistPuzzle(REDI),
} as const;

export type PuzzleId = keyof typeof PUZZLES;

/**
 * Any playable puzzle with its state and move types erased. The app hands a state
 * back to the puzzle that made it and never looks inside, so this is the one place
 * the types are let go.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPuzzle = Puzzle<any, any>;
export const puzzleOf = (id: PuzzleId): AnyPuzzle => PUZZLES[id];

/** Puzzles the library lists but cannot play yet. Each needs mechanics of its own before it moves up. */
export const COMING_SOON: readonly PuzzleInfo[] = [
  { name: 'Windmill Cube', category: 'Shape Mods', difficulty: 3, summary: 'A 3×3 cut on a slant, so the top looks like a pinwheel.' },
  { name: 'Axis Cube', category: 'Shape Mods', difficulty: 4, summary: 'A 3×3 that turns about axes through its edges and loses its shape at once.' },
  { name: 'Mastermorphix', category: 'Shape Mods', difficulty: 4, summary: 'A 3×3 in the shape of a rounded tetrahedron.' },
  { name: 'Ghost Cube', category: 'Shape Mods', difficulty: 5, summary: 'A 3×3 in one colour with misaligned layers. Every piece is a different shape.' },
  { name: 'Gear Cube', category: 'Mechanical Puzzles', difficulty: 2, summary: 'Geared edges make two layers turn together.' },
  { name: 'Mixup Cube', category: 'Mechanical Puzzles', difficulty: 4, summary: 'Slices stop at 45°, letting edges and centres change places.' },
  { name: 'Helicopter Cube', category: 'Mechanical Puzzles', difficulty: 4, summary: 'Turns about its twelve edges, and can jumble out of shape.' },
  { name: 'Ivy Cube', category: 'Advanced Puzzles', difficulty: 1, summary: 'Four corners turn, carrying leaf-shaped centres with them.' },
];
