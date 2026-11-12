import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Copy, Play, Redo2, Trash2, Undo2 } from 'lucide-react';
import { Transport } from '../components/algorithm/Transport';
import { Button, cx, IconButton, Label } from '../components/ui/ui';
import { applyMoves, turnedFaces } from '../engine/core/CubeState';
import { invertMoves } from '../engine/core/Move';
import { PUZZLES } from '../engine/puzzles';
import { useAlgorithm } from '../store/algorithmStore';
import { useCube } from '../store/cubeStore';

/** Moves shown in the history list. Older ones are counted, not rendered. */
const HISTORY_SHOWN = 240;

function History() {
  const history = useCube((s) => s.history);
  const state = useCube((s) => s.state);
  const size = useCube((s) => PUZZLES[s.puzzleId].size);
  const canRedo = useCube((s) => s.future.length > 0);
  const scramble = useCube((s) => s.scramble);
  const { undo, redo, clearHistory } = useCube.getState();
  const list = useRef<HTMLOListElement>(null);
  const hidden = Math.max(0, history.length - HISTORY_SHOWN);

  // Every move is a sticker in the colour of the face it turned. To find those colours, walk the cube back to
  // where the first move shown started, then forward again.
  const { shown, faces } = useMemo(() => {
    const shown = history.slice(-HISTORY_SHOWN);
    return { shown, faces: turnedFaces(applyMoves(state, invertMoves(shown)), shown, size) };
  }, [history, state, size]);

  // Keep the newest move in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [history.length]);

  return (
    <section aria-label="Move history" className="px-4 py-4">
      <div className="flex items-center gap-2">
        <Label>History</Label>
        <span className="font-mono text-xs text-muted">{history.length}</span>
        <div className="ml-auto flex gap-0.5">
          <IconButton label="Undo" disabled={history.length === 0} onClick={undo}>
            <Undo2 />
          </IconButton>
          <IconButton label="Redo" disabled={!canRedo} onClick={redo}>
            <Redo2 />
          </IconButton>
          <IconButton label="Clear history" disabled={history.length === 0 && !canRedo} onClick={clearHistory}>
            <Trash2 />
          </IconButton>
        </div>
      </div>
      {scramble.length > 0 && (
        <p className="mt-2 font-mono text-xs leading-relaxed text-muted">
          <span className="mr-2 text-[10px] tracking-[0.14em] text-faint uppercase">Scramble</span>
          {scramble.map((move) => move.notation).join(' ')}
        </p>
      )}
      {history.length === 0 ? (
        <p className="mt-2.5 rounded-lg border border-dotted border-white/20 px-3 py-3 text-xs leading-relaxed text-muted">
          No moves yet. Press R, U or F, or drag a face of the cube.
        </p>
      ) : (
        <ol ref={list} className="mt-2.5 flex max-h-44 flex-wrap gap-1 overflow-y-auto p-0.5">
          {hidden > 0 && <li className="flex h-6 items-center px-1 font-mono text-xs text-faint">+{hidden} earlier</li>}
          {shown.map((move, i) => (
            <li
              key={hidden + i}
              data-sticker={faces[i] ?? 'n'}
              data-lit=""
              className={cx(
                'chip h-6 min-w-6 rounded-[5px] px-1 text-xs',
                i === shown.length - 1 ? 'outline-2 outline-offset-1 outline-zinc-50' : 'opacity-75',
              )}
            >
              {move.notation}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PlaygroundPanel() {
  const input = useAlgorithm((s) => s.input);
  const setInput = useAlgorithm((s) => s.setInput);
  const puzzle = useCube((s) => PUZZLES[s.puzzleId]);
  const parsed = useMemo(() => puzzle.parse(input), [puzzle, input]);
  const field = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);
  const moves = parsed.ok ? parsed.moves : [];

  // Only a fully valid algorithm reaches the cube.
  const execute = () => {
    if (moves.length === 0) return;
    const playback = useAlgorithm.getState();
    playback.open(moves);
    void playback.play();
  };

  const reverse = () =>
    setInput(
      moves
        .map((move) => puzzle.invert(move).notation)
        .reverse()
        .join(' '),
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(input.trim());
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      field.current?.select(); // no clipboard access: select the text so the system shortcut works
    }
  };

  return (
    <div className="divide-y divide-dotted divide-white/20">
      <section aria-label="Algorithm" className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <Label>Algorithm</Label>
          {parsed.ok && (
            <span className="font-mono text-xs text-muted">
              {moves.length} {moves.length === 1 ? 'move' : 'moves'}
            </span>
          )}
        </div>
        <textarea
          ref={field}
          value={input}
          rows={3}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Algorithm"
          aria-invalid={!parsed.ok}
          aria-describedby={parsed.ok ? undefined : 'algorithm-error'}
          placeholder="R U R' U'"
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return;
            event.preventDefault();
            execute();
          }}
          className={cx(
            'mt-2.5 block w-full resize-none rounded-lg border bg-base px-3 py-2.5 font-mono text-[15px] leading-relaxed tracking-wide text-zinc-50 caret-accent placeholder:text-zinc-700 focus:outline-none',
            parsed.ok ? 'border-line focus:border-accent' : 'border-cube-red/70',
          )}
        />
        {!parsed.ok && (
          <div id="algorithm-error" role="alert" className="mt-2 text-xs leading-relaxed">
            <p className="text-cube-red">
              {parsed.error.message} <span className="opacity-70">(character {parsed.error.index + 1})</span>
            </p>
            <code className="mt-1 block truncate font-mono text-muted">
              {input.slice(0, parsed.error.index)}
              <mark className="rounded-sm bg-cube-red px-px text-ink">{input[parsed.error.index] ?? ' '}</mark>
              {input.slice(parsed.error.index + 1)}
            </code>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5 pb-1">
          <Button variant="primary" disabled={moves.length === 0} onClick={execute}>
            <Play />
            Execute
          </Button>
          <Button disabled={moves.length === 0} onClick={reverse}>
            <ArrowLeftRight />
            Reverse
          </Button>
          <Button disabled={input.trim() === ''} onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted">
          Faces R L U D F B, slices M E S, wide r or Rw, rotations x y z. Add ' to reverse, 2 to double, and (R U)3 to
          repeat.
        </p>
      </section>
      <Transport />
      <History />
    </div>
  );
}
