import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PUZZLES, type PuzzleId } from '../engine/puzzles';
import { currentPuzzle, useCube } from './cubeStore';
import { useSettings } from './settingsStore';

export interface Solve {
  id: string;
  ms: number;
  scramble: string;
  puzzle: PuzzleId;
  /** Date.now() when the solve finished. */
  at: number;
}

interface TimerStore {
  phase: 'idle' | 'inspecting' | 'running';
  /** True while the start key (or a finger) is held down. Releasing it starts the next phase. */
  armed: boolean;
  /** performance.now() at which the current phase began. */
  since: number;
  scramble: string;
  solves: Solve[];
  press(now?: number): void;
  release(now?: number): void;
  cancel(): void;
  newScramble(): void;
  removeSolve(id: string): void;
}

// The press that stops the timer is followed by a release; that release must not start the next solve.
let swallowRelease = false;
let inspectionTimeout: ReturnType<typeof setTimeout> | undefined;

const isSolve = (value: unknown): value is Solve => {
  const s = value as Solve | null;
  return (
    typeof s === 'object' && s !== null && typeof s.id === 'string' && typeof s.scramble === 'string' &&
    Number.isFinite(s.ms) && s.ms >= 0 && Number.isFinite(s.at) && typeof s.puzzle === 'string' && s.puzzle in PUZZLES
  );
};

export const useTimer = create<TimerStore>()(
  persist(
    (set, get) => ({
      phase: 'idle',
      armed: false,
      since: 0,
      scramble: '',
      solves: [],

      press: (now = performance.now()) => {
        const { phase, since, scramble } = get();
        if (phase !== 'running') return set({ armed: true });
        swallowRelease = true;
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
        const solve: Solve = { id, ms: now - since, scramble, puzzle: useCube.getState().puzzleId, at: Date.now() };
        set((s) => ({ phase: 'idle', armed: false, solves: [...s.solves, solve] }));
        get().newScramble();
      },

      release: (now = performance.now()) => {
        if (swallowRelease) {
          swallowRelease = false;
          return;
        }
        const { phase, armed } = get();
        if (!armed) return;
        clearTimeout(inspectionTimeout);
        const { inspection } = useSettings.getState();
        if (phase !== 'idle' || inspection === 0) return set({ phase: 'running', armed: false, since: now });
        set({ phase: 'inspecting', armed: false, since: now });
        // shortcut: running out of inspection starts the solve instead of applying WCA +2/DNF penalties.
        // Add penalties (and DNF-aware averages) if competition rules are needed.
        inspectionTimeout = setTimeout(() => {
          if (get().phase === 'inspecting') set({ phase: 'running', armed: false, since: performance.now() });
        }, inspection * 1000);
      },

      cancel: () => {
        clearTimeout(inspectionTimeout);
        swallowRelease = false;
        set({ phase: 'idle', armed: false });
      },

      newScramble: () => {
        const moves = currentPuzzle().scramble();
        useCube.getState().load(moves);
        set({ scramble: moves.map((move) => move.notation).join(' ') });
      },

      removeSolve: (id) => set((s) => ({ solves: s.solves.filter((solve) => solve.id !== id) })),
    }),
    {
      name: 'twistlab.timer',
      partialize: ({ solves }) => ({ solves }),
      merge: (saved, current) => {
        const solves = (saved as { solves?: unknown } | null)?.solves;
        return { ...current, solves: Array.isArray(solves) ? solves.filter(isSolve) : [] };
      },
    },
  ),
);
