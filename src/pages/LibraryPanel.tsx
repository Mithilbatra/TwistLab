import { Lock, Play } from 'lucide-react';
import { Button, cx, Label } from '../components/ui/ui';
import { COMING_SOON, PUZZLES, type PuzzleId } from '../engine/puzzles';
import { PUZZLE_CATEGORIES } from '../engine/puzzles/PuzzleEngine';
import { useCube } from '../store/cubeStore';
import { useSettings } from '../store/settingsStore';

const LEVELS = ['', 'Beginner', 'Easy', 'Intermediate', 'Hard', 'Expert'];

function Difficulty({ level }: { level: number }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={cx('size-1.5 rounded-[1px]', step <= level ? 'bg-accent' : 'bg-white/15')} />
        ))}
      </span>
      {LEVELS[level]}
    </span>
  );
}

/**
 * Every puzzle, by category. Choosing one puts it on the stage beside the list, where
 * it can be looked at from any side; Play then opens it in the playground. A puzzle
 * is listed as playable only once its mechanics exist and are tested.
 */
export function LibraryPanel() {
  const puzzleId = useCube((s) => s.puzzleId);
  const ids = Object.keys(PUZZLES) as PuzzleId[];

  return (
    <div className="divide-y divide-dotted divide-white/20">
      {PUZZLE_CATEGORIES.map((category) => {
        const playable = ids.filter((id) => PUZZLES[id].category === category);
        const planned = COMING_SOON.filter((puzzle) => puzzle.category === category);
        return (
          <section key={category} aria-label={category} className="px-4 py-4">
            <div className="flex items-baseline justify-between">
              <Label>{category}</Label>
              <span className="font-mono text-xs text-muted">
                {playable.length} of {playable.length + planned.length} playable
              </span>
            </div>
            <ul className="mt-3 space-y-2">
              {playable.map((id) => {
                const puzzle = PUZZLES[id];
                const active = id === puzzleId;
                return (
                  <li
                    key={id}
                    className={cx(
                      'rounded-xl border-[1.5px] transition-colors',
                      active ? 'border-accent bg-accent/[0.1]' : 'border-transparent bg-raised hover:bg-[#282a30]',
                    )}
                  >
                    <button
                      type="button"
                      aria-current={active ? 'true' : undefined}
                      onClick={() => useCube.getState().setPuzzle(id)}
                      className="block w-full rounded-xl px-3 py-2.5 text-left"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-zinc-50">{puzzle.name}</span>
                        <Difficulty level={puzzle.difficulty} />
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted">{puzzle.summary}</span>
                    </button>
                    {active && (
                      <div className="flex items-center gap-3 px-3 pb-3">
                        <Button variant="primary" onClick={() => useSettings.getState().setView('playground')}>
                          <Play />
                          Play
                        </Button>
                        <span className="text-xs text-muted">On the stage now. Drag around it to look.</span>
                      </div>
                    )}
                  </li>
                );
              })}
              {planned.map((puzzle) => (
                <li key={puzzle.name} className="rounded-xl border border-dotted border-white/20 px-3 py-2.5">
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-400">
                      <Lock size={13} className="shrink-0 text-faint" />
                      <span className="truncate">{puzzle.name}</span>
                    </span>
                    <span className="shrink-0 font-mono text-[10px] tracking-wider text-faint uppercase">Coming soon</span>
                  </span>
                  <span className="mt-1 flex items-start justify-between gap-3">
                    <span className="text-xs leading-relaxed text-faint">{puzzle.summary}</span>
                    <Difficulty level={puzzle.difficulty} />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
