import { Pause, Play, SkipBack, StepBack, StepForward, X } from 'lucide-react';
import { useAlgorithm } from '../../store/algorithmStore';
import { Button, cx, IconButton, Label } from '../ui/ui';

/** The loaded sequence: every move as a chip with the current one lit, plus step and play controls. */
export function Transport() {
  const title = useAlgorithm((s) => s.title);
  const moves = useAlgorithm((s) => s.moves);
  const index = useAlgorithm((s) => s.index);
  const playing = useAlgorithm((s) => s.playing);
  const { play, pause, next, previous, restart, close } = useAlgorithm.getState();
  if (moves.length === 0) return null;
  const finished = index >= moves.length;

  return (
    <section aria-label="Playback" className="px-4 py-4">
      <div className="flex items-baseline gap-2">
        <Label>{title ?? 'Sequence'}</Label>
        <span data-testid="playback-position" className="ml-auto font-mono text-xs text-zinc-500">
          <span className="text-zinc-100">{index}</span> / {moves.length}
        </span>
      </div>
      <ol className="mt-2.5 flex flex-wrap gap-1">
        {moves.map((move, i) => (
          <li
            key={i}
            aria-current={i === index - 1 ? 'step' : undefined}
            className={cx(
              'rounded px-1.5 py-0.5 font-mono text-[13px] transition-colors duration-150',
              i === index - 1 ? 'bg-accent text-accent-ink' : i < index ? 'text-zinc-600' : 'bg-white/[0.06] text-zinc-300',
            )}
          >
            {move.notation}
          </li>
        ))}
      </ol>
      <div className="mt-3 flex items-center gap-1">
        <IconButton label="Back to start" disabled={index === 0} onClick={restart}>
          <SkipBack />
        </IconButton>
        <IconButton label="Previous move" disabled={playing || index === 0} onClick={previous}>
          <StepBack />
        </IconButton>
        <Button variant="primary" className="w-24" onClick={() => (playing ? pause() : void play())}>
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : finished ? 'Replay' : index > 0 ? 'Resume' : 'Play'}
        </Button>
        <IconButton label="Next move" disabled={playing || finished} onClick={next}>
          <StepForward />
        </IconButton>
        <IconButton label="Close sequence" className="ml-auto" onClick={close}>
          <X />
        </IconButton>
      </div>
    </section>
  );
}
