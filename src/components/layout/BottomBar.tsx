import type { ReactNode } from 'react';
import { Keyboard, X } from 'lucide-react';
import { PUZZLES } from '../../engine/puzzles';
import { isMac } from '../../hooks/useKeyboard';
import { useCube } from '../../store/cubeStore';
import { LIMITS, MOVE_NAMES, useSettings } from '../../store/settingsStore';
import { cx, Kbd, Label } from '../ui/ui';

// The state light: green when every face is one colour, dark while it is not, red if the cube is impossible.
const STATUS = {
  solved: { label: 'Solved', tone: 'text-cube-green', led: 'bg-cube-green shadow-[0_0_10px_1px_var(--color-cube-green)]' },
  unsolved: { label: 'Unsolved', tone: 'text-zinc-400', led: 'bg-zinc-600' },
  invalid: { label: 'Invalid state', tone: 'text-cube-red', led: 'bg-cube-red shadow-[0_0_10px_1px_var(--color-cube-red)]' },
};

const ALT = isMac ? '⌥' : 'Alt';
const COMMAND = isMac ? '⌘' : 'Ctrl';

function Shortcut({ keys, children, muted }: { keys: string[]; children: ReactNode; muted?: boolean }) {
  return (
    <div className={cx('flex items-center justify-between gap-4 py-[3px]', muted && 'text-faint')}>
      <span>{children}</span>
      <span className="flex shrink-0 gap-1">
        {keys.map((key, i) => (
          <Kbd key={i}>{key}</Kbd>
        ))}
      </span>
    </div>
  );
}

/** The shortcut reference. It reads the live key map, so it always shows the keys as currently bound. */
function Shortcuts() {
  const keymap = useSettings((s) => s.keymap);
  const table = useCube((s) => PUZZLES[s.puzzleId].table);
  const cap = (family: string) => keymap[family]?.toUpperCase() || '–';
  return (
    <>
      <button
        type="button"
        popoverTarget="shortcuts"
        className="flex h-7 shrink-0 items-center gap-1.5 rounded-lg px-2 text-zinc-300 transition-colors hover:bg-white/[0.08] hover:text-zinc-50"
      >
        <Keyboard size={15} />
        Shortcuts
      </button>
      <div className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap 2xl:flex">
        {['R', 'L', 'U', 'D', 'F', 'B'].map((family) => (
          <Kbd key={family}>{cap(family)}</Kbd>
        ))}
        <span className="mr-2">turn</span>
        <Kbd>⇧</Kbd>
        <span className="mr-2">reverse</span>
        <Kbd>{ALT}</Kbd>
        <span>wide</span>
      </div>

      {/* A native popover: the browser handles the top layer, Escape and click-outside. */}
      <div
        id="shortcuts"
        popover="auto"
        className="m-auto max-h-[86dvh] w-[min(92vw,640px)] rounded-2xl bg-raised p-5 text-[13px] text-zinc-300 shadow-[inset_0_0_0_1px_#ffffff1f,0_30px_80px_#000] backdrop:bg-black/70 backdrop:backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <h2 className="display text-2xl text-zinc-50 uppercase">Keyboard shortcuts</h2>
          <button
            type="button"
            popoverTarget="shortcuts"
            popoverTargetAction="hide"
            aria-label="Close"
            className="rounded p-1 text-muted hover:bg-white/[0.07] hover:text-zinc-100"
          >
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 grid gap-x-10 gap-y-5 sm:grid-cols-2">
          <div>
            <Label className="mb-1.5">Turns</Label>
            {Object.keys(keymap).map((family) => (
              <Shortcut key={family} keys={[cap(family)]} muted={!table[family]}>
                {MOVE_NAMES[family]}
                {!table[family] && ' (3×3 only)'}
              </Shortcut>
            ))}
          </div>
          <div className="space-y-5">
            <div>
              <Label className="mb-1.5">Modifiers</Label>
              <Shortcut keys={['⇧', 'key']}>Turn counter-clockwise</Shortcut>
              <Shortcut keys={[ALT, 'face']}>Wide turn, two layers</Shortcut>
              <Shortcut keys={['key', 'key']}>Half turn</Shortcut>
            </div>
            <div>
              <Label className="mb-1.5">Playback and history</Label>
              <Shortcut keys={['Space']}>Play or pause the sequence</Shortcut>
              <Shortcut keys={['←', '→']}>Step back or forward</Shortcut>
              <Shortcut keys={[COMMAND, 'Z']}>Undo</Shortcut>
              <Shortcut keys={['⇧', COMMAND, 'Z']}>Redo</Shortcut>
            </div>
            <div>
              <Label className="mb-1.5">Timer</Label>
              <Shortcut keys={['Space']}>Hold, then release to start. Press to stop</Shortcut>
              <Shortcut keys={['Esc']}>Cancel the attempt</Shortcut>
            </div>
            <div>
              <Label className="mb-1.5">Mouse and touch</Label>
              <p className="leading-relaxed text-zinc-400">
                Drag a face to turn its layer. Drag the background to orbit. Scroll or pinch to zoom.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function BottomBar() {
  const speed = useSettings((s) => s.speed);
  const setSpeed = useSettings((s) => s.setSpeed);
  const moveCount = useCube((s) => s.history.filter((move) => PUZZLES[s.puzzleId].countsAsMove(move)).length);
  const status = useCube((s): keyof typeof STATUS => {
    const puzzle = PUZZLES[s.puzzleId];
    if (puzzle.validate(s.state).length > 0) return 'invalid';
    return puzzle.isSolved(s.state) ? 'solved' : 'unsolved';
  });

  return (
    <footer className="flex h-11 shrink-0 items-center gap-4 border-t border-dotted border-white/25 px-3 text-xs text-muted">
      <Shortcuts />
      <label className="ml-auto hidden shrink-0 items-center gap-2 sm:flex">
        Speed
        <input
          type="range"
          className="w-24"
          min={LIMITS.speed[0]}
          max={LIMITS.speed[1]}
          step={0.25}
          value={speed}
          onChange={(event) => setSpeed(Number(event.target.value))}
        />
        <span className="w-9 font-mono text-zinc-200">{speed}×</span>
      </label>
      <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0">
        Moves
        {/* A counter with its unlit digits showing. Only the lit ones are the count. */}
        <span className="display text-[22px] text-zinc-50">
          <span aria-hidden="true" className="text-zinc-700">
            {'0'.repeat(Math.max(0, 3 - String(moveCount).length))}
          </span>
          <span data-testid="move-count">{moveCount}</span>
        </span>
      </div>
      <div className={cx('flex shrink-0 items-center gap-2', STATUS[status].tone)}>
        <span aria-hidden="true" className={cx('size-2 rounded-[2px]', STATUS[status].led)} />
        <span data-testid="cube-status" className="font-mono text-[11px] font-semibold tracking-[0.14em] uppercase">
          {STATUS[status].label}
        </span>
      </div>
    </footer>
  );
}
