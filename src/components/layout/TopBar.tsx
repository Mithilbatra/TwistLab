import { useEffect, useState } from 'react';
import { ChevronDown, Maximize, Minimize, RotateCcw, Settings, Shuffle } from 'lucide-react';
import { PUZZLES, type PuzzleId } from '../../engine/puzzles';
import { PUZZLE_CATEGORIES } from '../../engine/puzzles/PuzzleEngine';
import { useCube } from '../../store/cubeStore';
import { useSettings } from '../../store/settingsStore';
import { useTimer } from '../../store/timerStore';
import { Button, IconButton, Logo } from '../ui/ui';

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
      <h1 className="sr-only">{PUZZLES[puzzleId].name}</h1>
      {/* The browser's own menu does the choosing, so it works with a keyboard and on a phone. What shows is drawn to match the keys beside it. */}
      <label className="key relative flex h-8 min-w-0 items-center gap-1.5 rounded-lg bg-raised pr-2 pl-3 text-[13px] font-medium text-zinc-50 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent hover:bg-[#282a30]">
        {/* The full name where there is room for it, the short one on a phone. */}
        <span aria-hidden="true" className="truncate max-sm:hidden">
          {PUZZLES[puzzleId].name}
        </span>
        <span aria-hidden="true" className="truncate font-mono text-xs font-semibold sm:hidden">
          {PUZZLES[puzzleId].label}
        </span>
        <ChevronDown size={14} aria-hidden="true" className="shrink-0 text-muted" />
        <select
          aria-label="Puzzle"
          value={puzzleId}
          onChange={(event) => {
            useCube.getState().setPuzzle(event.target.value as PuzzleId);
            event.target.blur(); // hand the keyboard back to the puzzle
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {PUZZLE_CATEGORIES.map((category) => {
            const ids = (Object.keys(PUZZLES) as PuzzleId[]).filter((id) => PUZZLES[id].category === category);
            return (
              ids.length > 0 && (
                <optgroup key={category} label={category}>
                  {ids.map((id) => (
                    <option key={id} value={id}>
                      {PUZZLES[id].name}
                    </option>
                  ))}
                </optgroup>
              )
            );
          })}
        </select>
      </label>
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
