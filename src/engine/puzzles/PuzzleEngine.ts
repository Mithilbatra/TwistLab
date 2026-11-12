import type { ParseResult } from '../core/MoveParser';

/**
 * Everything the application needs from a puzzle. Stores, playback, the timer and
 * the UI only ever talk to this interface, so a new puzzle is one implementation
 * of it plus a 3D model. Nothing above the engine has to change.
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
