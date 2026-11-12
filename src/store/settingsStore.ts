import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type View = 'playground' | 'lab' | 'learn' | 'timer' | 'library' | 'settings';

/** One key per move family. Shift turns it the other way; Alt makes a face turn wide. */
export const DEFAULT_KEYMAP: Readonly<Record<string, string>> = {
  R: 'r', L: 'l', U: 'u', D: 'd', F: 'f', B: 'b', M: 'm', E: 'e', S: 's', x: 'x', y: 'y', z: 'z',
};

/** What each move family turns, for the shortcut reference and the key editor. */
export const MOVE_NAMES: Readonly<Record<string, string>> = {
  R: 'Right face', L: 'Left face', U: 'Up face', D: 'Down face', F: 'Front face', B: 'Back face',
  M: 'Middle slice', E: 'Equator slice', S: 'Standing slice',
  x: 'Rotate like R', y: 'Rotate like U', z: 'Rotate like F',
};

export const LIMITS ={ speed: [0.25, 4], inspection: [0, 60], fov: [15, 70] } as const;

interface Settings {
  view: View;
  /** Animation speed multiplier. */
  speed: number;
  /** Inspection time in seconds; 0 turns inspection off. */
  inspection: number;
  /** Camera field of view in degrees. */
  fov: number;
  keymap: Record<string, string>;
  setView(view: View): void;
  setSpeed(speed: number): void;
  setInspection(seconds: number): void;
  setFov(fov: number): void;
  bindKey(family: string, key: string): void;
  resetKeymap(): void;
}

const clamp = (value: unknown, [min, max]: readonly [number, number], fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

export const useSettings = create<Settings>()(
  persist(
    (set, get) => ({
      view: 'playground',
      speed: 1,
      inspection: 15,
      fov: 35,
      keymap: { ...DEFAULT_KEYMAP },
      setView: (view) => set({ view }),
      setSpeed: (speed) => set({ speed: clamp(speed, LIMITS.speed, get().speed) }),
      setInspection: (seconds) => set({ inspection: Math.round(clamp(seconds, LIMITS.inspection, get().inspection)) }),
      setFov: (fov) => set({ fov: clamp(fov, LIMITS.fov, get().fov) }),
      // A key drives one family only, so binding it here unbinds whichever family had it.
      bindKey: (family, key) =>
        set(({ keymap }) => ({
          keymap: { ...Object.fromEntries(Object.entries(keymap).map(([f, k]) => [f, k === key ? '' : k])), [family]: key },
        })),
      resetKeymap: () => set({ keymap: { ...DEFAULT_KEYMAP } }),
    }),
    {
      name: 'twistlab.settings',
      partialize: ({ speed, inspection, fov, keymap }) => ({ speed, inspection, fov, keymap }),
      // Saved data is untrusted: an old or hand-edited entry must not put the app in a broken state.
      merge: (saved, current) => {
        const s = (saved ?? {}) as Partial<Settings>;
        return {
          ...current,
          speed: clamp(s.speed, LIMITS.speed, current.speed),
          inspection: Math.round(clamp(s.inspection, LIMITS.inspection, current.inspection)),
          fov: clamp(s.fov, LIMITS.fov, current.fov),
          keymap: Object.fromEntries(
            Object.entries(DEFAULT_KEYMAP).map(([family, key]) => {
              const savedKey = s.keymap?.[family];
              return [family, typeof savedKey === 'string' ? savedKey : key];
            }),
          ),
        };
      },
    },
  ),
);
