import { useEffect, useState } from 'react';
import { Maximize, Minimize, RotateCcw, Settings, Shuffle } from 'lucide-react';
import { PUZZLES, type PuzzleId } from '../../engine/puzzles';
import { useCube } from '../../store/cubeStore';
import { useSettings } from '../../store/settingsStore';
import { useTimer } from '../../store/timerStore';
import { Button, cx, IconButton, Logo } from '../ui/ui';

export function TopBar() {
  const puzzleId = useCube((s) => s.puzzleId);
  const view = useSettings((s) => s.view);
  const setView = useSettings((s) => s.setView);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  const toggleFullscreen = () => {
    const change = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    change.catch(() => {}); // the browser refused: stay as we are
  };

  // In the timer the cube shows the timer's scramble, so "Scramble" means a new one of those.
  const scramble = () => (view === 'timer' ? useTimer.getState().newScramble() : useCube.getState().scrambleCube());

  return (
    <header className="tile flex h-12 shrink-0 items-center gap-3 px-3">
      <Logo className="md:hidden" />
      <span className="display hidden text-[23px] text-zinc-50 xl:block">
        TWIST<span className="text-accent">LAB</span>
      </span>
      <span aria-hidden="true" className="hidden h-5 border-l border-dotted border-white/35 xl:block" />
      <h1 className="min-w-0 truncate text-sm font-medium text-zinc-50">{PUZZLES[puzzleId].name}</h1>
      <div role="radiogroup" aria-label="Puzzle" className="flex shrink-0 gap-0.5 rounded-lg bg-base p-0.5 shadow-[inset_0_0_0_1px_#ffffff17]">
        {(Object.keys(PUZZLES) as PuzzleId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === puzzleId}
            aria-label={PUZZLES[id].name}
            onClick={() => useCube.getState().setPuzzle(id)}
            className={cx(
              'h-7 rounded-md px-2 font-mono text-xs transition-colors',
              id === puzzleId ? 'bg-accent font-semibold text-accent-ink' : 'text-zinc-400 hover:text-zinc-100',
            )}
          >
            {PUZZLES[id].size}×{PUZZLES[id].size}
          </button>
        ))}
      </div>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <Button aria-label="Scramble" onClick={scramble}>
          <Shuffle />
          <span className="hidden sm:inline">Scramble</span>
        </Button>
        <Button aria-label="Reset" disabled={view === 'timer'} onClick={() => useCube.getState().load()}>
          <RotateCcw />
          <span className="hidden sm:inline">Reset</span>
        </Button>
        <IconButton label="Settings" className="max-sm:hidden" onClick={() => setView('settings')}>
          <Settings />
        </IconButton>
        {document.fullscreenEnabled && (
          <IconButton label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize /> : <Maximize />}
          </IconButton>
        )}
      </div>
    </header>
  );
}
