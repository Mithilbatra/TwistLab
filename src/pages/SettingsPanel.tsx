import { useEffect, useState } from 'react';
import { Button, cx, Kbd, Label } from '../components/ui/ui';
import { PUZZLES } from '../engine/puzzles';
import { isMac } from '../hooks/useKeyboard';
import { useAlgorithm } from '../store/algorithmStore';
import { useCube } from '../store/cubeStore';
import { LIMITS, MOVE_NAMES, useSettings } from '../store/settingsStore';
import { useTimer } from '../store/timerStore';

export function SettingsPanel() {
  const speed = useSettings((s) => s.speed);
  const fov = useSettings((s) => s.fov);
  const inspection = useSettings((s) => s.inspection);
  const keymap = useSettings((s) => s.keymap);
  const table = useCube((s) => PUZZLES[s.puzzleId].table);
  const { setSpeed, setFov, setInspection, bindKey, resetKeymap } = useSettings.getState();
  /** The move family waiting for its new key, if any. */
  const [binding, setBinding] = useState<string | null>(null);

  // While a key is being assigned this listener sees it first, so it never reaches the cube.
  useEffect(() => {
    if (!binding) return;
    const capture = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Backspace' || event.key === 'Delete') bindKey(binding, '');
      else if (event.key.length === 1 && event.key !== ' ') bindKey(binding, event.key.toLowerCase());
      else if (event.key !== 'Escape') return; // a modifier or a reserved key: keep waiting
      setBinding(null);
    };
    window.addEventListener('keydown', capture, true);
    return () => window.removeEventListener('keydown', capture, true);
  }, [binding, bindKey]);

  const slider = 'w-32';

  return (
    <div className="divide-y divide-line">
      <section className="space-y-3 px-4 py-4">
        <Label>Animation and camera</Label>
        <label className="flex items-center justify-between gap-3">
          <span>Turn speed</span>
          <span className="flex items-center gap-2.5">
            <input
              type="range"
              className={slider}
              min={LIMITS.speed[0]}
              max={LIMITS.speed[1]}
              step={0.25}
              value={speed}
              onChange={(event) => setSpeed(Number(event.target.value))}
            />
            <span className="w-10 text-right font-mono text-xs text-zinc-400">{speed}×</span>
          </span>
        </label>
        <label className="flex items-center justify-between gap-3">
          <span>Perspective</span>
          <span className="flex items-center gap-2.5">
            <input
              type="range"
              className={slider}
              min={LIMITS.fov[0]}
              max={LIMITS.fov[1]}
              step={1}
              value={fov}
              onChange={(event) => setFov(Number(event.target.value))}
            />
            <span className="w-10 text-right font-mono text-xs text-zinc-400">{fov}°</span>
          </span>
        </label>
      </section>

      <section className="px-4 py-4">
        <Label>Timer</Label>
        <label className="mt-3 flex items-center justify-between gap-3">
          <span>
            Inspection time
            <span className="ml-2 text-xs text-zinc-600">seconds, 0 for none</span>
          </span>
          <input
            type="number"
            inputMode="numeric"
            min={LIMITS.inspection[0]}
            max={LIMITS.inspection[1]}
            value={inspection}
            onChange={(event) => setInspection(event.target.valueAsNumber)}
            className="h-8 w-16 rounded-md border border-line bg-base px-2 text-right font-mono text-sm text-zinc-50 focus:border-zinc-500 focus:outline-none"
          />
        </label>
      </section>

      <section className="px-4 py-4">
        <div className="flex items-center justify-between">
          <Label>Keyboard</Label>
          <Button variant="ghost" className="-mr-2 h-7 text-xs" onClick={resetKeymap}>
            Restore defaults
          </Button>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Choose a move, then press its new key. <Kbd>⇧</Kbd> reverses any turn and <Kbd>{isMac ? '⌥' : 'Alt'}</Kbd> makes
          a face turn wide.
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
          {Object.keys(keymap).map((family) => (
            <li key={family} className="flex items-center justify-between gap-2">
              <span className={cx('truncate', !table[family] && 'text-zinc-600')}>
                <span className="mr-2 inline-block w-3 font-mono text-zinc-100">{family}</span>
                {MOVE_NAMES[family]}
              </span>
              <button
                type="button"
                aria-label={`Key for ${family}, ${MOVE_NAMES[family]}: ${keymap[family] || 'none'}`}
                onClick={() => setBinding(binding === family ? null : family)}
                className={cx(
                  'h-7 min-w-9 shrink-0 rounded-md border px-2 font-mono text-xs transition-colors',
                  binding === family
                    ? 'border-accent text-accent'
                    : 'border-line bg-white/[0.04] text-zinc-100 hover:bg-white/[0.09]',
                )}
              >
                {binding === family ? '…' : keymap[family].toUpperCase() || '–'}
              </button>
            </li>
          ))}
        </ul>
        {binding && (
          <p role="status" className="mt-3 text-xs text-accent">
            Press a key for {binding}. Backspace clears it, Escape cancels.
          </p>
        )}
      </section>

      <section className="px-4 py-4">
        <Label>Saved data</Label>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Solves, favourites, lesson progress and these settings are stored in this browser only.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <Button
            onClick={() => {
              if (window.confirm('Delete every recorded solve, for all puzzles? This cannot be undone.'))
                useTimer.setState({ solves: [] });
            }}
          >
            Delete all solves
          </Button>
          <Button
            onClick={() => {
              if (window.confirm('Reset lesson progress?')) useAlgorithm.setState({ completedLessons: [] });
            }}
          >
            Reset lesson progress
          </Button>
        </div>
      </section>
    </div>
  );
}
