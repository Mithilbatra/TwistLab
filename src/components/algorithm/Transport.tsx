import { useMemo } from 'react';
import { Pause, Play, SkipBack, StepBack, StepForward, X } from 'lucide-react';
import { applyMoves, turnedFaces } from '../../engine/core/CubeState';
import { invertMoves } from '../../engine/core/Move';
import { PUZZLES } from '../../engine/puzzles';
import { useAlgorithm } from '../../store/algorithmStore';
import { useCube } from '../../store/cubeStore';
import { Button, IconButton, Label } from '../ui/ui';

/**
 * The loaded sequence as a strip of stickers, plus step and play controls. Each move is
 * the colour of the face it turns, and lights up once it has been played.
 */
export function Transport() {
  const title = useAlgorithm((s) => s.title);
  const moves = useAlgorithm((s) => s.moves);
  const index = useAlgorithm((s) => s.index);
  const playing = useAlgorithm((s) => s.playing);
  const state = useCube((s) => s.state);
  const size = useCube((s) => PUZZLES[s.puzzleId].size);
  const { play, pause, next, previous, restart, close } = useAlgorithm.getState();
  // Walk the cube back to where the sequence began, then forward, noting the face each move turns.
  const faces = useMemo(
    () => turnedFaces(applyMoves(state, invertMoves(moves.slice(0, index))), moves, size),
    [state, moves, index, size],
  );
  if (moves.length === 0) return null;
  const finished = index >= moves.length;

  return (
    <section aria-label="Playback" className="px-4 py-4">
      <div className="flex items-end gap-2">
        <Label>{title ?? 'Sequence'}</Label>
        <span data-testid="playback-position" className="display ml-auto text-[22px] text-faint">
          <span className="text-zinc-50">{index}</span> / {moves.length}
        </span>
      </div>
      <ol className="mt-3 flex flex-wrap gap-1.5">
        {moves.map((move, i) => (
          <li
            key={i}
            aria-current={i === index - 1 ? 'step' : undefined}
            data-sticker={faces[i] ?? 'n'}
            data-lit={i < index ? '' : undefined}
            className="chip"
          >
            {move.notation}
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center gap-1.5 pb-1">
        <IconButton variant="outline" label="Back to start" disabled={index === 0} onClick={restart}>
          <SkipBack />
        </IconButton>
        <IconButton variant="outline" label="Previous move" disabled={playing || index === 0} onClick={previous}>
          <StepBack />
        </IconButton>
        <Button variant="primary" className="w-24" onClick={() => (playing ? pause() : void play())}>
          {playing ? <Pause /> : <Play />}
          {playing ? 'Pause' : finished ? 'Replay' : index > 0 ? 'Resume' : 'Play'}
        </Button>
        <IconButton variant="outline" label="Next move" disabled={playing || finished} onClick={next}>
          <StepForward />
        </IconButton>
        <IconButton label="Close sequence" className="ml-auto" onClick={close}>
          <X />
        </IconButton>
      </div>
    </section>
  );
}
