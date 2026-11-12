import { useEffect, useRef } from 'react';
import { useCube } from '../../store/cubeStore';
import { useSettings } from '../../store/settingsStore';
import { useTimer } from '../../store/timerStore';
import { formatTime } from '../../utils/stats';
import { cx } from '../ui/ui';

/** The scramble and the clock. Space drives it from the keyboard; pressing it works for mouse and touch. */
export function TimerDisplay() {
  const phase = useTimer((s) => s.phase);
  const armed = useTimer((s) => s.armed);
  const scramble = useTimer((s) => s.scramble);
  const puzzleId = useCube((s) => s.puzzleId);
  const lastMs = useTimer((s) => s.solves.findLast((solve) => solve.puzzle === puzzleId)?.ms);
  const readout = useRef<HTMLDivElement>(null);

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
      className="shrink-0 touch-none border-b border-line px-4 py-4 text-center select-none"
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture(event.pointerId); // so the release arrives even if the pointer wanders off
        useTimer.getState().press();
      }}
      onPointerUp={() => useTimer.getState().release()}
      onPointerCancel={() => useTimer.getState().cancel()}
    >
      <p data-testid="timer-scramble" className="mx-auto max-w-2xl font-mono text-sm leading-relaxed text-zinc-300">
        {scramble}
      </p>
      <div
        ref={readout}
        data-testid="timer-readout"
        className={cx(
          'mt-1.5 font-mono text-6xl leading-none font-medium tabular-nums transition-colors sm:text-7xl',
          armed ? 'text-accent' : phase === 'inspecting' ? 'text-amber-300' : 'text-zinc-50',
        )}
      >
        {phase === 'idle' ? formatTime(lastMs ?? 0) : null}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{hint}</p>
    </div>
  );
}
