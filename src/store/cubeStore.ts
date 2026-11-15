import { create } from 'zustand';
import { AnimationQueue } from '../engine/animation/AnimationQueue';
import { PUZZLES, puzzleOf, type AnyPuzzle, type PuzzleId } from '../engine/puzzles';

/** A move, as far as the stores are concerned: they hand moves back to the puzzle and read only how each is written. */
export interface Step {
  readonly notation: string;
}

/** A puzzle's state. Every puzzle has its own kind, and only that puzzle ever looks inside one. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Opaque = any;

/** What the 3D model shows. It trails the logical state in `useCube` while turns animate. */
export const animation = new AnimationQueue<Opaque, Opaque>(PUZZLES['3x3'].createSolved());

interface CubeStore {
  puzzleId: PuzzleId;
  /** The logical cube. Updated synchronously on every move; it never waits for an animation. */
  state: Opaque;
  history: Step[];
  /** Undone moves, most recent last. */
  future: Step[];
  /** The scramble the current position started from, if any. */
  scramble: Step[];
  /** Most recent turn. The serial makes the same move twice in a row register as new. */
  lastTurn: { notation: string; serial: number } | null;
  /** Counts replacements of the whole cube (reset, scramble, puzzle switch), as opposed to turns. */
  epoch: number;
  /** Ids of cubies to grey out, used by lessons to focus on one stage. */
  dimmed: ReadonlySet<number> | null;
  setPuzzle(id: PuzzleId): void;
  /** Makes the moves, or none of them if the puzzle refuses one (a Square-1 slash with a piece in the way). */
  turn(moves: readonly Step[]): boolean;
  undo(): void;
  redo(): void;
  /** Replaces the cube with solved + `setup`, without animation, and clears the history. */
  load(setup?: readonly Step[]): void;
  scrambleCube(): void;
  clearHistory(): void;
  setDimmed(ids: ReadonlySet<number> | null): void;
}

export const currentPuzzle = (): AnyPuzzle => puzzleOf(useCube.getState().puzzleId);

/** The first of `moves`, made in turn from `state`, that the puzzle refuses, and why. Null when it takes them all. */
export function firstBlocked(puzzle: AnyPuzzle, state: Opaque, moves: readonly Step[]): { index: number; reason: string } | null {
  if (!puzzle.blocked) return null;
  for (const [index, move] of moves.entries()) {
    const reason = puzzle.blocked(state, move);
    if (reason) return { index, reason };
    state = puzzle.apply(state, move);
  }
  return null;
}

export const useCube = create<CubeStore>()((set, get) => {
  /** Applies moves to the logical state right away and queues the matching animations. */
  const advance = (moves: readonly Step[]) => {
    const puzzle = currentPuzzle();
    let { state } = get();
    for (const move of moves) {
      const to = puzzle.apply(state, move);
      animation.enqueue({ move, from: state, to });
      state = to;
    }
    const serial = (get().lastTurn?.serial ?? 0) + 1;
    return { state, lastTurn: { notation: moves[moves.length - 1].notation, serial } };
  };

  return {
    puzzleId: '3x3',
    state: PUZZLES['3x3'].createSolved(),
    history: [],
    future: [],
    scramble: [],
    lastTurn: null,
    epoch: 0,
    dimmed: null,

    // One update, so no subscriber ever sees the new puzzle paired with the old puzzle's cubies.
    setPuzzle: (puzzleId) => {
      if (puzzleId === get().puzzleId) return;
      const state = PUZZLES[puzzleId].createSolved();
      animation.reset(state);
      set((s) => ({ puzzleId, state, history: [], future: [], scramble: [], lastTurn: null, dimmed: null, epoch: s.epoch + 1 }));
    },

    turn: (moves) => {
      if (moves.length === 0 || firstBlocked(currentPuzzle(), get().state, moves)) return false;
      const next = advance(moves);
      set((s) => ({ ...next, history: [...s.history, ...moves], future: [] }));
      return true;
    },

    // Undo plays the exact inverse turn. The engine is integer-only, so this restores the previous state bit for bit.
    undo: () => {
      const move = get().history.at(-1);
      if (!move) return;
      const next = advance([currentPuzzle().invert(move)]);
      set((s) => ({ ...next, history: s.history.slice(0, -1), future: [...s.future, move] }));
    },

    redo: () => {
      const move = get().future.at(-1);
      if (!move) return;
      const next = advance([move]);
      set((s) => ({ ...next, history: [...s.history, move], future: s.future.slice(0, -1) }));
    },

    load: (setup = []) => {
      const puzzle = currentPuzzle();
      const state = setup.reduce((current, move) => puzzle.apply(current, move), puzzle.createSolved());
      animation.reset(state);
      set((s) => ({ state, history: [], future: [], scramble: [], lastTurn: null, epoch: s.epoch + 1 }));
    },

    scrambleCube: () => {
      const scramble = currentPuzzle().scramble();
      get().load();
      set({ ...advance(scramble), scramble, lastTurn: null }); // a scramble is not a move to call out
    },

    clearHistory: () => set({ history: [], future: [] }),
    setDimmed: (dimmed) => set({ dimmed }),
  };
});
