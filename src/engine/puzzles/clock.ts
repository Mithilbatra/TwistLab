import { parseSequence, SyntaxProblem } from '../core/MoveParser';
import type { Puzzle } from './PuzzleEngine';

/**
 * Rubik's Clock. Nine dials on each side, read row by row as seen from that side. The
 * four corner dials are one axle seen from both sides, so a corner turning clockwise
 * on the front turns anticlockwise on the back. Four pins choose what a wheel drives:
 * a pin that is up joins the four front dials around it.
 *
 * WCA notation names the pins that are up and how far the dials they join turn:
 * UR3+ (the top-right pin up, its dials three hours clockwise), U2- (both top pins up,
 * two hours back), ALL6+, and y2 to turn the clock over.
 */
export interface ClockState {
  /** The dials facing you, then the dials behind, each read row by row from its own side. 0 is twelve o'clock. */
  readonly front: readonly number[];
  readonly back: readonly number[];
  /** True while the clock's second face is the one towards you. It changes nothing about being solved. */
  readonly flipped: boolean;
}

export type ClockMove =
  | { readonly kind: 'turn'; readonly pins: string; readonly amount: number; readonly notation: string }
  | { readonly kind: 'flip'; readonly notation: string };

export type ClockPuzzle = Puzzle<ClockState, ClockMove>;

/** The four front dials around each pin. */
const AROUND = { UL: [0, 1, 3, 4], UR: [1, 2, 4, 5], DL: [3, 4, 6, 7], DR: [4, 5, 7, 8] } as const;
type Pin = keyof typeof AROUND;
/** Which pins each name puts up. Longer names first, so that UR is never read as U then R. */
export const PIN_SETS: Readonly<Record<string, readonly Pin[]>> = {
  ALL: ['UL', 'UR', 'DL', 'DR'],
  UR: ['UR'],
  DR: ['DR'],
  DL: ['DL'],
  UL: ['UL'],
  U: ['UL', 'UR'],
  R: ['UR', 'DR'],
  D: ['DL', 'DR'],
  L: ['UL', 'DL'],
};
/** Seen from behind the clock is mirrored left to right: the front's top-left axle is the back's top-right. */
export const BEHIND: Readonly<Record<number, number>> = { 0: 2, 2: 0, 6: 8, 8: 6 };

const hours = (n: number) => ((n % 12) + 12) % 12;

/** What a turn moves: the front dials next to an up pin, and, behind, the corners on the same axles. */
export function movingDials(pins: string): { front: number[]; back: number[] } {
  const front = [...new Set(PIN_SETS[pins].flatMap((pin) => AROUND[pin]))].sort((a, b) => a - b);
  return { front, back: front.filter((dial) => dial in BEHIND).map((corner) => BEHIND[corner]) };
}

export const clockTurn = (pins: string, amount: number): ClockMove => ({
  kind: 'turn',
  pins,
  amount: amount || 0, // never -0
  notation: `${pins}${Math.abs(amount)}${amount < 0 ? '-' : '+'}`,
});
export const FLIP: ClockMove = { kind: 'flip', notation: 'y2' };

function apply(s: ClockState, move: ClockMove): ClockState {
  if (move.kind === 'flip') return { front: s.back, back: s.front, flipped: !s.flipped };
  const moving = movingDials(move.pins);
  return {
    front: s.front.map((dial, i) => (moving.front.includes(i) ? hours(dial + move.amount) : dial)),
    back: s.back.map((dial, i) => (moving.back.includes(i) ? hours(dial - move.amount) : dial)),
    flipped: s.flipped,
  };
}

const NAMES = Object.keys(PIN_SETS);

function read(input: string, start: number) {
  if (input.startsWith('y2', start)) return { move: FLIP, end: start + 2 };
  const name = NAMES.find((candidate) => input.startsWith(candidate, start));
  if (!name) {
    const head = String.fromCodePoint(input.codePointAt(start)!);
    throw new SyntaxProblem(
      `"${head}" is not a move on a Rubik's Clock. Name the pins that are up and the turn, as in UR3+ or ALL2-, or turn it over with y2`,
      start,
    );
  }
  let i = start + name.length;
  const digits = /^\d*/.exec(input.slice(i))![0];
  i += digits.length;
  if (digits === '')
    throw new SyntaxProblem(`${name} needs a turn after it, as in ${name}3+. Here every move sets its own pins`, start);
  if (Number(digits) > 6)
    throw new SyntaxProblem(`"${name}${digits}" turns too far. Turn 0 to 6 hours, + clockwise or - anticlockwise`, start);
  const sign = input[i];
  if (sign !== '+' && sign !== '-') throw new SyntaxProblem(`Add + or - after ${name}${digits}: + turns clockwise, - anticlockwise`, start);
  return { move: clockTurn(name, sign === '-' ? -Number(digits) : Number(digits)), end: i + 1 };
}

/**
 * The WCA's format: a turn for each of the nine pin settings on the front, y2, then five more on the back.
 * Those fourteen turns set the fourteen dials that move independently, so random amounts give a uniformly
 * random position: this is a random-state scramble.
 */
function scramble(random: () => number = Math.random): ClockMove[] {
  const amount = () => Math.floor(random() * 12) - 5; // -5 to 6 hours
  return [
    ...['UR', 'DR', 'DL', 'UL', 'U', 'R', 'D', 'L', 'ALL'].map((pins) => clockTurn(pins, amount())),
    FLIP,
    ...['U', 'R', 'D', 'L', 'ALL'].map((pins) => clockTurn(pins, amount())),
  ];
}

const SOLVED: ClockState = { front: Array(9).fill(0), back: Array(9).fill(0), flipped: false };

function validate(s: ClockState): string[] {
  const dials = [...s.front, ...s.back];
  if (typeof s.flipped !== 'boolean') return ['It is not clear which face is towards you'];
  if (s.front.length !== 9 || s.back.length !== 9 || dials.some((dial) => !Number.isInteger(dial) || dial < 0 || dial > 11))
    return ['A dial is missing or does not show an hour'];
  return [0, 2, 6, 8].every((corner) => s.back[BEHIND[corner]] === hours(-s.front[corner]))
    ? []
    : ['A corner dial does not match the dial on the other end of its axle'];
}

export const CLOCK: ClockPuzzle = {
  id: 'clock',
  name: "Rubik's Clock",
  label: 'Clock',
  category: 'WCA Puzzles',
  difficulty: 2,
  summary: 'Eighteen dials on two faces, set by four wheels and four pins. Solved when every dial shows twelve.',
  help: 'Name the pins that are up and how far their dials turn: UR3+, U2-, ALL6+ (pins UR DR DL UL, pairs U R D L, or ALL; 0 to 6 hours, + clockwise). y2 turns the clock over. Drag a dial to turn it; Y turns the clock over.',
  moveNames: { y: 'Turn the clock over' },
  keys: { y: 'y2', "y'": 'y2' },
  model: { kind: 'clock' },
  createSolved: () => SOLVED,
  parse: (algorithm) => parseSequence(algorithm, read),
  apply,
  invert: (move) => (move.kind === 'turn' ? clockTurn(move.pins, -move.amount) : FLIP),
  isSolved: (s) => s.front.every((dial) => dial === 0) && s.back.every((dial) => dial === 0),
  validate,
  scramble,
  countsAsMove: (move) => move.kind === 'turn',
  faces: (_start, moves) => moves.map(() => null),
};
