import { Lock } from 'lucide-react';
import { cx, Label } from '../components/ui/ui';
import { PUZZLES, UPCOMING, type PuzzleId } from '../engine/puzzles';
import { useCube } from '../store/cubeStore';
import { useSettings } from '../store/settingsStore';

/** An n×n face, as a small picture of the puzzle. */
function Glyph({ size }: { size: number }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 gap-0.5 rounded-md bg-white/[0.05] p-1.5"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size * size }, (_, i) => (
        <span key={i} className="rounded-[1px] bg-zinc-300" />
      ))}
    </span>
  );
}

export function LibraryPanel() {
  const puzzleId = useCube((s) => s.puzzleId);

  const open = (id: PuzzleId) => {
    useCube.getState().setPuzzle(id);
    useSettings.getState().setView('playground');
  };

  return (
    <div className="divide-y divide-line">
      <section className="px-4 py-4">
        <Label>Puzzle Library</Label>
        <ul className="mt-3 space-y-1.5">
          {(Object.keys(PUZZLES) as PuzzleId[]).map((id) => {
            const active = id === puzzleId;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => open(id)}
                  className={cx(
                    'flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-colors',
                    active ? 'border-accent/40 bg-accent/[0.06]' : 'border-line hover:bg-white/[0.04]',
                  )}
                >
                  <Glyph size={PUZZLES[id].size} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-zinc-50">{PUZZLES[id].name}</span>
                    <span className="block text-xs text-zinc-500">{PUZZLES[id].summary}</span>
                  </span>
                  <span className={cx('text-xs', active ? 'text-accent' : 'text-zinc-500')}>{active ? 'Active' : 'Open'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 py-4">
        <Label>Coming soon</Label>
        <ul className="mt-3 space-y-1.5">
          {UPCOMING.map((puzzle) => (
            <li key={puzzle.name} className="flex items-center gap-3 rounded-lg border border-dashed border-line px-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-white/[0.03] text-zinc-600">
                <Lock size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-zinc-500">{puzzle.name}</span>
                <span className="block text-xs text-zinc-600">{puzzle.summary}</span>
              </span>
              <span className="text-[11px] text-zinc-600">Not yet available</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Each puzzle is an engine plus a 3D model behind one interface, so playback, history and the timer work with a
          new puzzle as they are.
        </p>
      </section>
    </div>
  );
}
