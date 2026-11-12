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
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-line bg-panel px-3">
      <Logo className="md:hidden" />
      <h1 className="min-w-0 truncate text-sm font-medium text-zinc-50">{PUZZLES[puzzleId].name}</h1>
      <div role="radiogroup" aria-label="Puzzle" className="flex shrink-0 rounded-md border border-line p-0.5">
        {(Object.keys(PUZZLES) as PuzzleId[]).map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === puzzleId}
            aria-label={PUZZLES[id].name}
            onClick={() => useCube.getState().setPuzzle(id)}
            className={cx(
              'h-6 rounded px-2 font-mono text-xs transition-colors',
              id === puzzleId ? 'bg-white/10 text-zinc-50' : 'text-zinc-500 hover:text-zinc-200',
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
