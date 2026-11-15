import type { V3 } from '../core/geometry';
import type { ParseResult } from '../core/MoveParser';

/**
 * Everything the application needs from a puzzle's mechanics. Stores, playback, the
 * timer and the UI only ever talk to this interface, so a new puzzle is one
 * implementation of it plus a 3D model. Nothing above the engine has to change.
 *
 * S is the puzzle's state and M its move type. Both are immutable values.
 */
export interface PuzzleEngine<S, M extends { readonly notation: string }> {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  createSolved(): S;
  parse(algorithm: string): ParseResult<M>;
  apply(state: S, move: M): S;
  invert(move: M): M;
  isSolved(state: S): boolean;
  /** Rules the state breaks; empty when it is reachable by legal moves. */
  validate(state: S): string[];
  scramble(random?: () => number): M[];
  /** Whole-puzzle rotations change the view, not the puzzle, so they are not counted. */
  countsAsMove(move: M): boolean;
}

export const PUZZLE_CATEGORIES = ['Classic Cubes', 'WCA Puzzles', 'Shape Mods', 'Mechanical Puzzles', 'Advanced Puzzles'] as const;
export type PuzzleCategory = (typeof PUZZLE_CATEGORIES)[number];

/** What the library says about a puzzle, whether or not it can be played yet. */
export interface PuzzleInfo {
  readonly name: string;
  readonly category: PuzzleCategory;
  /** 1 is gentle, 5 is fearsome. */
  readonly difficulty: 1 | 2 | 3 | 4 | 5;
  readonly summary: string;
}

/** One piece drawn from its own geometry: flat triangles, each corner tagged with a colour (-1 is the dark body). */
export interface PieceMesh {
  readonly positions: readonly number[];
  readonly tags: readonly number[];
}

/**
 * How a puzzle that is not a plain cube is drawn and handled. Every piece is a solid
 * modelled in its solved place, and the state says how each has been turned about
 * the centre since.
 */
export interface PieceModel<S, M> {
  readonly kind: 'pieces';
  /** Scale that brings the puzzle to the size of the stage, and how far to lower it towards the floor. */
  readonly scale: number;
  readonly drop: number;
  readonly pieces: readonly PieceMesh[];
  /** Rotation (row-major 3×3) that carries piece `i` from its solved place to where `state` has it. */
  pose(state: S, i: number): readonly number[];
  /** The rigid turn `move` makes from `state`: about which axis, by what angle, and which pieces ride on it. */
  turning(state: S, move: M): { axis: V3; angle: number; moving: readonly boolean[] };
  /** The turns that would take piece `i` with them: each one's axis, and the move for a turn either way about it. */
  grips(state: S, i: number): { axis: V3; turn(direction: 1 | -1): M }[];
}

/** A playable puzzle: its mechanics, what the library says about it, and what the 3D view needs to draw it. */
export interface Puzzle<S, M extends { readonly notation: string }> extends PuzzleEngine<S, M>, PuzzleInfo {
  /** Short name for tight spaces: "3×3", "Pyraminx". */
  readonly label: string;
  /** One line on how its moves are written. */
  readonly help: string;
  /** What the move keys turn on this puzzle, where that is not a cube's faces. */
  readonly moveNames?: Readonly<Record<string, string>>;
  /** A plain cube has a model of its own (rounded cubies); everything else is drawn piece by piece. */
  readonly model: { readonly kind: 'cube' } | PieceModel<S, M>;
  /** For each move of a sequence played from `start`: the colour (0 to 5) of the face it turns, or null if it turns no one face. */
  faces(start: S, moves: readonly M[]): (number | null)[];
}
