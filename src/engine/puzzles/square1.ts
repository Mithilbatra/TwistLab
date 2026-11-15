import { clip, scale, shell, type Solid, type V3 } from '../core/geometry';
import { SyntaxProblem, type ParseResult } from '../core/MoveParser';
import type { PieceMesh, PieceModel, Puzzle } from './PuzzleEngine';
import { meshOf } from './twistPuzzle';

/**
 * The Square-1. Its top and bottom layers are rings of twelve 30° slots, filled by
 * corners (two slots wide) and edges (one). A turn spins a layer round its ring; a
 * slash turns the right half of the puzzle over, and is only possible when no corner
 * lies across the cut. Pieces take different widths, so the puzzle changes shape.
 *
 * Slots follow the WCA scrambler: both rings start at the front end of the slash,
 * the top's running clockwise seen from above and the bottom's clockwise seen from
 * below. With that, a slash simply exchanges top slots 6–11 with bottom slots 0–5.
 */
export interface Square1State {
  /** Which piece fills each slot. A corner's id is in both of its slots. */
  readonly top: readonly number[];
  readonly bottom: readonly number[];
  /** 1 while the right half of the middle layer is turned over. */
  readonly middle: 0 | 1;
}

export type Square1Move =
  | { readonly kind: 'turn'; readonly top: number; readonly bottom: number; readonly notation: string }
  | { readonly kind: 'slash'; readonly notation: string };

export type Square1Puzzle = Puzzle<Square1State, Square1Move>;

const SOLVED: Square1State = {
  top: [0, 0, 1, 2, 2, 3, 4, 4, 5, 6, 6, 7],
  bottom: [8, 9, 9, 10, 11, 11, 12, 13, 13, 14, 15, 15],
  middle: 0,
};
/** How many slots each piece takes: 2 for a corner, 1 for an edge. */
const WIDTH = new Map<number, number>();
for (const id of [...SOLVED.top, ...SOLVED.bottom]) WIDTH.set(id, (WIDTH.get(id) ?? 0) + 1);

const MAX_MOVES = 2000;
/** Amounts are kept between -5 and 6 twelfths, as the WCA writes them. */
const wrap = (n: number) => {
  const m = ((n % 12) + 12) % 12;
  return m > 6 ? m - 12 : m;
};
/** Turns a ring clockwise by `by` slots: the piece in slot k moves to slot k + by. */
const rotate = (ring: readonly number[], by: number) => ring.map((_, k) => ring[(((k - by) % 12) + 12) % 12]);

export const turn = (top: number, bottom: number): Square1Move => ({
  kind: 'turn',
  top: wrap(top),
  bottom: wrap(bottom),
  notation: `(${wrap(top)},${wrap(bottom)})`,
});
export const SLASH: Square1Move = { kind: 'slash', notation: '/' };

/** A ring can be cut before slot k unless one corner fills the slots on both sides of that line. */
const clear = (ring: readonly number[], k: number) => ring[k % 12] !== ring[(k + 11) % 12];
export const slashable = (s: Square1State) => clear(s.top, 0) && clear(s.top, 6) && clear(s.bottom, 0) && clear(s.bottom, 6);

function apply(s: Square1State, move: Square1Move): Square1State {
  if (move.kind === 'turn') return { ...s, top: rotate(s.top, move.top), bottom: rotate(s.bottom, move.bottom) };
  return {
    top: [...s.top.slice(0, 6), ...s.bottom.slice(0, 6)],
    bottom: [...s.top.slice(6), ...s.bottom.slice(6)],
    middle: s.middle === 0 ? 1 : 0,
  };
}

const TURN_SHAPE = 'A turn is written (top,bottom), as in (1,0) or (-2,3)';

/** WCA notation: (x,y) turns, and / for the slash. The brackets may be left out: 1,0/-1,0/. */
function parse(input: string): ParseResult<Square1Move> {
  const moves: Square1Move[] = [];
  let i = 0;
  const skip = () => {
    while (i < input.length && /\s/.test(input[i])) i++;
  };
  // One layer's amount: an optional minus sign and digits, between -6 and 6.
  const amount = (start: number) => {
    skip();
    const digits = /^-?\d+/.exec(input.slice(i))?.[0];
    if (digits === undefined) throw new SyntaxProblem(TURN_SHAPE, start);
    i += digits.length;
    if (Math.abs(Number(digits)) > 6)
      throw new SyntaxProblem(`"${digits}" turns too far. Each layer turns between -6 and 6 twelfths`, i - digits.length);
    return Number(digits);
  };
  try {
    for (;;) {
      skip();
      if (i >= input.length) return { ok: true, moves };
      const start = i;
      if (input[i] === '/') {
        moves.push(SLASH);
        i++;
      } else if (input[i] === ')') {
        throw new SyntaxProblem('This ")" has no matching "("', start);
      } else if (input[i] === '(' || input[i] === '-' || /\d/.test(input[i])) {
        const bracketed = input[i] === '(';
        if (bracketed) i++;
        const top = amount(start);
        skip();
        if (input[i] !== ',') throw new SyntaxProblem(TURN_SHAPE, start);
        i++;
        const bottom = amount(start);
        skip();
        if (bracketed && input[i] !== ')') throw new SyntaxProblem('This "(" is never closed', start);
        if (bracketed) i++;
        if (wrap(top) === 0 && wrap(bottom) === 0) throw new SyntaxProblem('This turn moves nothing', start);
        moves.push(turn(top, bottom));
      } else {
        const head = String.fromCodePoint(input.codePointAt(i)!);
        throw new SyntaxProblem(`"${head}" is not a move on a Square-1. It turns (top,bottom), and slashes with /`, start);
      }
      if (moves.length > MAX_MOVES) throw new SyntaxProblem(`Algorithms are limited to ${MAX_MOVES} moves`, start);
    }
  } catch (problem) {
    if (problem instanceof SyntaxProblem) return { ok: false, error: { message: problem.message, index: problem.index } };
    throw problem;
  }
}

/**
 * Twelve slashes, each after a turn chosen at random from those that leave the slash free.
 *
 * shortcut: random-move, not the WCA's random-state scrambles. Upgrade when a Square-1 solver is available.
 */
function scramble(random: () => number = Math.random): Square1Move[] {
  const moves: Square1Move[] = [];
  let state = SOLVED;
  for (let slashes = 0; slashes < 12; slashes++) {
    // Only the first slash may come with no turn before it: two slashes in a row would cancel.
    const options: (Square1Move | null)[] = slashes === 0 ? [null] : [];
    for (let top = -5; top <= 6; top++)
      for (let bottom = -5; bottom <= 6; bottom++)
        if ((top !== 0 || bottom !== 0) && slashable(apply(state, turn(top, bottom)))) options.push(turn(top, bottom));
    const pick = options[Math.floor(random() * options.length)];
    for (const move of pick ? [pick, SLASH] : [SLASH]) {
      moves.push(move);
      state = apply(state, move);
    }
  }
  return moves;
}

/** Every piece in its own slot, every corner whole and in one ring. Whether turns can reach it is not checked. */
function validate(s: Square1State): string[] {
  const rings = [s.top, s.bottom];
  if (rings.some((ring) => ring.length !== 12)) return ['A layer does not have twelve slots'];
  const taken = new Map<number, number>();
  for (const id of [...s.top, ...s.bottom]) taken.set(id, (taken.get(id) ?? 0) + 1);
  if (taken.size !== WIDTH.size || [...taken].some(([id, slots]) => WIDTH.get(id) !== slots))
    return ['A piece is missing, doubled, or the wrong size'];
  for (const ring of rings)
    for (let k = 0; k < 12; k++)
      if (WIDTH.get(ring[k]) === 2 && ring[(k + 1) % 12] !== ring[k] && ring[(k + 11) % 12] !== ring[k])
        return ['A corner is split in two'];
  return s.middle === 0 || s.middle === 1 ? [] : ['The middle layer is neither square nor turned over'];
}

const isSolved = (s: Square1State) =>
  s.middle === 0 && s.top.every((id, k) => id === SOLVED.top[k]) && s.bottom.every((id, k) => id === SOLVED.bottom[k]);

// ---- How it is drawn: each piece cut from a cube, posed from where the state puts it ----

const DEG = Math.PI / 180;
/** The middle layer's half-height, the cube's half-width being 1. */
const MIDDLE_HALF = 0.32;
const UP: V3 = [0, 1, 0];
/** The horizontal direction `phi` degrees clockwise from the right, seen from above: +x turning towards the front, +z. */
const dir = (phi: number): V3 => [Math.cos(phi * DEG), 0, Math.sin(phi * DEG)];
/** The slash's cut runs through 105° (the front) and 285°; it turns about the line square to it. */
const SLASH_AXIS = dir(15);

interface Place {
  readonly layer: 'top' | 'bottom';
  readonly slot: number;
  readonly width: number;
}
function placeOf(s: Square1State, id: number): Place {
  for (const layer of ['top', 'bottom'] as const) {
    const at = s[layer].indexOf(id);
    if (at < 0) continue;
    const width = WIDTH.get(id)!;
    // A corner over the start of the ring sits in slots 11 and 0, so it starts at 11.
    return { layer, width, slot: width === 2 && at === 0 && s[layer][11] === id ? 11 : at };
  }
  throw new Error(`Piece ${id} is not on the puzzle`);
}
/** The angles a place covers. Top slot k covers 105 + 30k to 135 + 30k; the bottom's run the other way round. */
const spanOf = ({ layer, slot, width }: Place): [number, number] =>
  layer === 'top' ? [105 + 30 * slot, 105 + 30 * (slot + width)] : [105 - 30 * (slot + width), 105 - 30 * slot];
const middleOf = (place: Place) => (spanOf(place)[0] + spanOf(place)[1]) / 2;

/** Rotation by `deg` degrees about +y: anticlockwise seen from above, by the right-hand rule. Row-major. */
const yTurn = (deg: number) => {
  const c = Math.cos(deg * DEG);
  const s = Math.sin(deg * DEG);
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const times = (a: readonly number[], b: readonly number[]) =>
  a.map((_, i) => {
    const r = i - (i % 3);
    const c = i % 3;
    return a[r] * b[c] + a[r + 1] * b[c + 3] + a[r + 2] * b[c + 6];
  });
/** Half a turn about the slash's axis. */
const FLIP = (() => {
  const [x, , z] = SLASH_AXIS;
  return [2 * x * x - 1, 0, 2 * x * z, 0, -1, 0, 2 * x * z, 0, 2 * z * z - 1];
})();
/** Every pose a piece can take: k twelfths clockwise seen from above (0–11), the same after the slash's flip (12–23). */
const POSES = Array.from({ length: 24 }, (_, i) => times(yTurn(-30 * (i % 12)), i < 12 ? yTurn(0) : FLIP));

function pose(s: Square1State, i: number): readonly number[] {
  if (i >= 16) return i === 17 && s.middle ? POSES[12] : POSES[0];
  const home = placeOf(SOLVED, i);
  const now = placeOf(s, i);
  const flipped = home.layer !== now.layer;
  // The flip mirrors angles about its axis (φ to 30 − φ); turns then carry the piece round to where it is.
  const steps = Math.round((middleOf(now) - (flipped ? 30 - middleOf(home) : middleOf(home))) / 30);
  return POSES[(((steps % 12) + 12) % 12) + (flipped ? 12 : 0)];
}

const PIECES = Array.from({ length: 18 }, (_, i) => i);
const inRightHalf = (s: Square1State) => new Set([...s.top.slice(6), ...s.bottom.slice(0, 6), 17]);

function turning(s: Square1State, move: Square1Move) {
  if (move.kind === 'slash') {
    const right = inRightHalf(s);
    return [{ axis: SLASH_AXIS, angle: Math.PI, moving: PIECES.map((i) => right.has(i)) }];
  }
  // Clockwise seen from above is the negative way round +y; the bottom's clockwise, seen from below, the positive way.
  return [
    { axis: UP, angle: (-move.top * Math.PI) / 6, moving: PIECES.map((i) => s.top.includes(i)) },
    { axis: UP, angle: (move.bottom * Math.PI) / 6, moving: PIECES.map((i) => s.bottom.includes(i)) },
  ].filter((part) => part.angle !== 0);
}

function grips(s: Square1State, i: number) {
  const out: { axis: V3; turn(direction: 1 | -1): Square1Move }[] = [];
  // A drag that turns a piece the positive way round +y is anticlockwise seen from above: the top's -1, the bottom's +1.
  if (s.top.includes(i)) out.push({ axis: UP, turn: (d) => turn(-d, 0) });
  if (s.bottom.includes(i)) out.push({ axis: UP, turn: (d) => turn(0, d) });
  if (slashable(s) && inRightHalf(s).has(i)) out.push({ axis: SLASH_AXIS, turn: () => SLASH });
  return out;
}

function cells(): Solid[] {
  const cube = shell(([[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]] as V3[]).map((n, colour) => ({ n, d: 1, colour })));
  const top = clip(cube, [0, -1, 0], -MIDDLE_HALF);
  const bottom = clip(cube, [0, 1, 0], -MIDDLE_HALF);
  const middle = clip(clip(cube, [0, 1, 0], MIDDLE_HALF), [0, -1, 0], MIDDLE_HALF);
  // A wedge between two angles: the cut at each end faces away from the piece.
  const wedge = (layer: Solid, [from, to]: [number, number]) => clip(clip(layer, dir(from - 90), 0), dir(to + 90), 0);
  return [
    ...PIECES.slice(0, 16).map((id) => {
      const place = placeOf(SOLVED, id);
      return wedge(place.layer === 'top' ? top : bottom, spanOf(place));
    }),
    clip(middle, SLASH_AXIS, 0),
    clip(middle, scale(SLASH_AXIS, -1), 0),
  ];
}

let meshes: PieceMesh[] | undefined;
const model: PieceModel<Square1State, Square1Move> = {
  kind: 'pieces',
  scale: 1.5,
  drop: 0,
  get pieces() {
    return (meshes ??= cells().map((cell) => meshOf(cell, 1 / 1.5)));
  },
  pose,
  turning,
  grips,
};

export const SQUARE1: Square1Puzzle = {
  id: 'square1',
  name: 'Square-1',
  label: 'Square-1',
  category: 'WCA Puzzles',
  difficulty: 4,
  summary: 'Changes shape as it turns, and has to be squared up before it can be solved.',
  help: "(1,0) turns the top a twelfth clockwise and (0,1) the bottom, each seen from its own side. / turns the right half over once no piece is in its way. Keys: U and D (Shift for the other way) and /.",
  moveNames: { U: 'Top layer, a twelfth', D: 'Bottom layer, a twelfth' },
  keys: { U: '(1,0)', "U'": '(-1,0)', D: '(0,1)', "D'": '(0,-1)' },
  model,
  createSolved: () => SOLVED,
  parse,
  apply,
  invert: (move) => (move.kind === 'turn' ? turn(-move.top, -move.bottom) : SLASH),
  isSolved,
  validate,
  scramble,
  blocked: (s, move) =>
    move.kind === 'slash' && !slashable(s) ? 'a piece lies across the slash. Turn the top or bottom until the cut is clear' : null,
  countsAsMove: () => true,
  faces: (_start, moves) => moves.map(() => null),
};
