import { Lock } from 'lucide-react';
import { cx, Label } from '../components/ui/ui';
import { PUZZLES, UPCOMING, type PuzzleId } from '../engine/puzzles';
import { useCube } from '../store/cubeStore';
import { useSettings } from '../store/settingsStore';

/** An n×n face as a small picture of the puzzle, its stickers taken in turn from the six colours. */
function Glyph({ size, lit }: { size: number; lit: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-11 shrink-0 gap-[3px] rounded-lg bg-base p-[5px]"
      style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
    >
      {Array.from({ length: size * size }, (_, i) => (
        <span
          key={i}
          data-sticker={(i * 5 + size) % 6}
          className={cx('rounded-[2px] bg-(--sticker) transition-opacity', !lit && 'opacity-40')}
        />
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
    <div className="divide-y divide-dotted divide-white/20">
      <section className="px-4 py-4">
        <Label>Ready to play</Label>
        <ul className="mt-3 space-y-2.5">
          {(Object.keys(PUZZLES) as PuzzleId[]).map((id) => {
            const active = id === puzzleId;
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => open(id)}
                  className={cx(
                    'key group flex w-full items-center gap-3 rounded-xl border-[1.5px] px-3 py-3 text-left',
                    active ? 'border-accent bg-accent/[0.12]' : 'border-transparent bg-raised hover:bg-[#282a30]',
                  )}
                >
                  <Glyph size={PUZZLES[id].size} lit={active} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-zinc-50">{PUZZLES[id].name}</span>
                    <span className="block text-xs text-muted">{PUZZLES[id].summary}</span>
                  </span>
                  <span
                    className={cx(
                      'font-mono text-[10px] font-semibold tracking-[0.14em] uppercase',
                      active ? 'text-accent' : 'text-muted group-hover:text-zinc-200',
                    )}
                  >
                    {active ? 'Active' : 'Open'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="px-4 py-4">
        <Label>Coming soon</Label>
        <ul className="mt-3 space-y-2">
          {UPCOMING.map((puzzle) => (
            <li key={puzzle.name} className="flex items-center gap-3 rounded-xl border border-dotted border-white/20 px-3 py-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-faint">
                <Lock size={15} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-zinc-400">{puzzle.name}</span>
                <span className="block text-xs text-faint">{puzzle.summary}</span>
              </span>
              <span className="text-[11px] text-faint">Not yet available</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Each puzzle is an engine plus a 3D model behind one interface, so playback, history and the timer work with a
          new puzzle as they are.
        </p>
      </section>
    </div>
  );
}
