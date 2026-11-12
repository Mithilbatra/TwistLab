import { useMemo } from 'react';
import { Trash2 } from 'lucide-react';
import { Distribution } from '../components/statistics/Distribution';
import { IconButton, Label } from '../components/ui/ui';
import { useCube } from '../store/cubeStore';
import { LIMITS, useSettings } from '../store/settingsStore';
import { useTimer } from '../store/timerStore';
import { averageOf, formatTime } from '../utils/stats';

const show = (ms: number | null) => (ms === null ? '–' : formatTime(ms));

export function TimerPanel() {
  const puzzleId = useCube((s) => s.puzzleId);
  const allSolves = useTimer((s) => s.solves);
  const inspection = useSettings((s) => s.inspection);
  // Statistics are kept per puzzle: a 2×2 time says nothing about a 3×3 average.
  const solves = useMemo(() => allSolves.filter((solve) => solve.puzzle === puzzleId), [allSolves, puzzleId]);
  const times = solves.map((solve) => solve.ms);
  const best = times.length > 0 ? Math.min(...times) : null;
  const mean = times.length > 0 ? times.reduce((sum, time) => sum + time, 0) / times.length : null;

  const stats = [
    ['Solves', String(times.length)],
    ['Best', show(best)],
    ['Mean', show(mean)],
    ['Average of 5', show(averageOf(times, 5))],
    ['Average of 12', show(averageOf(times, 12))],
  ];

  return (
    <div className="divide-y divide-line">
      <section aria-label="Statistics" className="px-4 py-4">
        <Label>Statistics</Label>
        <dl className="mt-3 grid grid-cols-3 gap-x-3 gap-y-4">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt className="text-[11px] text-zinc-500">{label}</dt>
              <dd className="mt-0.5 text-lg font-semibold text-zinc-50">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="px-4 py-4">
        <Label>Time distribution</Label>
        <Distribution times={times} />
      </section>

      <section className="flex items-center justify-between gap-3 px-4 py-3">
        <label htmlFor="inspection" className="text-zinc-300">
          Inspection
          <span className="ml-2 text-xs text-zinc-600">seconds, 0 for none</span>
        </label>
        <input
          id="inspection"
          type="number"
          inputMode="numeric"
          min={LIMITS.inspection[0]}
          max={LIMITS.inspection[1]}
          value={inspection}
          onChange={(event) => useSettings.getState().setInspection(event.target.valueAsNumber)}
          className="h-8 w-16 rounded-md border border-line bg-base px-2 text-right font-mono text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
        />
      </section>

      <section aria-label="Solve history">
        <div className="flex items-baseline justify-between px-4 pt-4 pb-2">
          <Label>Solves</Label>
          <span className="font-mono text-xs text-zinc-500">{solves.length}</span>
        </div>
        {solves.length === 0 ? (
          <p className="px-4 pb-4 text-xs text-zinc-600">No solves yet. Scramble your cube to match, then hold Space.</p>
        ) : (
          <ol className="divide-y divide-line">
            {solves.toReversed().map((solve, i) => (
              <li key={solve.id} className="flex items-center gap-3 py-1 pr-2 pl-4">
                <span className="w-6 font-mono text-xs text-zinc-600">{solves.length - i}</span>
                <span className="w-16 font-mono text-sm text-zinc-100 tabular-nums">{formatTime(solve.ms)}</span>
                <span className="w-5 text-[10px] font-semibold text-accent">{solve.ms === best && 'PB'}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-zinc-600" title={solve.scramble}>
                  {solve.scramble}
                </span>
                <IconButton
                  label={`Delete solve ${solves.length - i}`}
                  onClick={() => useTimer.getState().removeSolve(solve.id)}
                >
                  <Trash2 />
                </IconButton>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
