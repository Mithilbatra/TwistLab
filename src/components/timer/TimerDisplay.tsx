import { useEffect, useMemo, useRef } from 'react';
import { turnedFaces } from '../../engine/core/CubeState';
import { PUZZLES } from '../../engine/puzzles';
import { useCube } from '../../store/cubeStore';
import { useSettings } from '../../store/settingsStore';
import { useTimer } from '../../store/timerStore';
import { formatTime } from '../../utils/stats';
import { cx, Stickers } from '../ui/ui';

/** The scramble and the clock. Space drives it from the keyboard; pressing it works for mouse and touch. */
export function TimerDisplay() {
  const phase = useTimer((s) => s.phase);
  const armed = useTimer((s) => s.armed);
  const scramble = useTimer((s) => s.scramble);
  const puzzleId = useCube((s) => s.puzzleId);
  const lastMs = useTimer((s) => s.solves.findLast((solve) => solve.puzzle === puzzleId)?.ms);
  const readout = useRef<HTMLDivElement>(null);

  // The scramble as stickers: each move in the colour of the face to turn, on a cube held white up, green in front.
  const strip = useMemo(() => {
    const puzzle = PUZZLES[puzzleId];
    const parsed = puzzle.parse(scramble);
    const moves = parsed.ok ? parsed.moves : [];
    return { moves, faces: turnedFaces(puzzle.createSolved(), moves, puzzle.size) };
  }, [scramble, puzzleId]);

  // A fresh scramble when the timer opens or the puzzle changes; abandon any attempt when it closes.
  useEffect(() => {
    useTimer.getState().newScramble();
    return () => useTimer.getState().cancel();
  }, [puzzleId]);

  // The running clock writes straight to the DOM: sixty updates a second without re-rendering React.
  useEffect(() => {
    if (phase === 'idle') return;
    let frame = 0;
    const draw = () => {
      const elapsed = performance.now() - useTimer.getState().since;
      const text =
        phase === 'running'
          ? formatTime(elapsed)
          : String(Math.max(0, Math.ceil(useSettings.getState().inspection - elapsed / 1000)));
      if (readout.current && readout.current.textContent !== text) readout.current.textContent = text;
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [phase]);

  const hint =
    phase === 'running'
      ? 'Press Space to stop'
      : armed
        ? 'Release to start'
        : phase === 'inspecting'
          ? 'Inspecting. Hold Space and release to start the solve'
          : 'Hold Space, or press here, and release to start';

  return (
    <div
      className="shrink-0 touch-none border-b border-dotted border-white/25 px-4 pt-3 pb-2.5 text-center select-none sm:pt-4 sm:pb-3"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId); // so the release arrives even if the pointer wanders off
        useTimer.getState().press();
      }}
      onPointerUp={() => useTimer.getState().release()}
      onPointerCancel={() => useTimer.getState().cancel()}
    >
      <p data-testid="timer-scramble" className="mx-auto flex min-h-6 max-w-2xl justify-center">
        {strip.moves.length > 0 && <Stickers moves={strip.moves} faces={strip.faces} className="justify-center" />}
      </p>
      {/* The digits are a dot-matrix display. They are monospaced, so the running clock does not shift about. */}
      <div
        ref={readout}
        data-testid="timer-readout"
        className={cx(
          'mt-2 font-display text-[56px] leading-[0.9] font-black transition-colors [text-shadow:0_0_32px_color-mix(in_oklab,currentColor_45%,transparent)] sm:mt-3 sm:text-[104px]',
          // Green means go, as on a competition timer, whatever colour the section is.
          armed ? 'text-cube-green' : phase === 'inspecting' ? 'text-cube-yellow' : 'text-zinc-50',
        )}
      >
        {phase === 'idle' ? formatTime(lastMs ?? 0) : null}
      </div>
      <p className="mt-1.5 font-mono text-[10px] tracking-[0.04em] text-muted uppercase sm:mt-2 sm:tracking-[0.14em]">{hint}</p>
    </div>
  );
}
