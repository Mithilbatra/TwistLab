import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Move } from '../engine/core/Move';
import { animation, currentPuzzle, useCube } from './cubeStore';

interface AlgorithmStore {
  /** Text in the playground input. */
  input: string;
  /** Name of the loaded sequence when it came from the library or a lesson. */
  title: string | null;
  moves: Move[];
  /** Position a demo starts from. When set, restarting rebuilds it instead of rewinding move by move. */
  setup: Move[] | null;
  /** How many of `moves` have been applied. */
  index: number;
  playing: boolean;
  favourites: string[];
  completedLessons: string[];
  setInput(input: string): void;
  /** Loads a sequence for playback. A demo also puts the cube in its starting position. */
  open(moves: Move[], demo?: { title: string; setup: Move[] }): void;
  close(): void;
  play(): Promise<void>;
  pause(): void;
  next(): void;
  previous(): void;
  restart(): void;
  toggleFavourite(id: string): void;
  setLessonDone(id: string, done: boolean): void;
}

/** Identifies the active play loop, so a superseded one stops itself after its current turn. */
let run = 0;

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
const toggled = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((x) => x !== id));

export const useAlgorithm = create<AlgorithmStore>()(
  persist(
    (set, get) => ({
      input: "R U R' U'",
      title: null,
      moves: [],
      setup: null,
      index: 0,
      playing: false,
      favourites: [],
      completedLessons: [],

      setInput: (input) => set({ input }),

      open: (moves, demo) => {
        run++;
        if (demo) useCube.getState().load(demo.setup);
        set({ moves, title: demo?.title ?? null, setup: demo?.setup ?? null, index: 0, playing: false });
      },

      close: () => {
        run++;
        set({ moves: [], title: null, setup: null, index: 0, playing: false });
      },

      play: async () => {
        if (get().playing || get().moves.length === 0) return;
        if (get().index >= get().moves.length) get().restart();
        const mine = ++run;
        set({ playing: true });
        // One turn at a time: the next move is issued only when the previous animation has finished.
        while (mine === run && get().index < get().moves.length) {
          get().next();
          await animation.whenIdle();
        }
        if (mine === run) set({ playing: false });
      },

      pause: () => {
        run++;
        set({ playing: false });
      },

      next: () => {
        const { moves, index } = get();
        if (index >= moves.length) return;
        useCube.getState().turn([moves[index]]);
        set({ index: index + 1 });
      },

      previous: () => {
        const { moves, index } = get();
        if (index === 0) return;
        useCube.getState().turn([currentPuzzle().invert(moves[index - 1])]);
        set({ index: index - 1 });
      },

      restart: () => {
        const { moves, index, setup } = get();
        run++;
        if (setup) useCube.getState().load(setup);
        else useCube.getState().turn(moves.slice(0, index).reverse().map(currentPuzzle().invert));
        set({ index: 0, playing: false });
      },

      toggleFavourite: (id) => set((s) => ({ favourites: toggled(s.favourites, id, !s.favourites.includes(id)) })),
      setLessonDone: (id, done) => set((s) => ({ completedLessons: toggled(s.completedLessons, id, done) })),
    }),
    {
      name: 'twistlab.algorithms',
      partialize: ({ input, favourites, completedLessons }) => ({ input, favourites, completedLessons }),
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<AlgorithmStore>;
        return {
          ...current,
          input: typeof s.input === 'string' ? s.input : current.input,
          favourites: strings(s.favourites),
          completedLessons: strings(s.completedLessons),
        };
      },
    },
  ),
);

// The loaded sequence describes one cube. If that cube is replaced, rewind; if the puzzle changes, drop it.
useCube.subscribe((cube, previous) => {
  if (cube.puzzleId !== previous.puzzleId) useAlgorithm.getState().close();
  else if (cube.epoch !== previous.epoch) {
    run++;
    useAlgorithm.setState({ index: 0, playing: false });
  }
});
