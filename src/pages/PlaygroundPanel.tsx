import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, Check, Copy, Play, Redo2, Trash2, Undo2 } from 'lucide-react';
import { Transport } from '../components/algorithm/Transport';
import { Button, cx, IconButton, Label } from '../components/ui/ui';
import { PUZZLES } from '../engine/puzzles';
import { useAlgorithm } from '../store/algorithmStore';
import { useCube } from '../store/cubeStore';

/** Moves shown in the history list. Older ones are counted, not rendered. */
const HISTORY_SHOWN = 240;

function History() {
  const history = useCube((s) => s.history);
  const canRedo = useCube((s) => s.future.length > 0);
  const scramble = useCube((s) => s.scramble);
  const { undo, redo, clearHistory } = useCube.getState();
  const list = useRef<HTMLOListElement>(null);
  const hidden = Math.max(0, history.length - HISTORY_SHOWN);

  // Keep the newest move in view.
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [history.length]);

  return (
    <section aria-label="Move history" className="px-4 py-4">
      <div className="flex items-center gap-2">
        <Label>History</Label>
        <span className="font-mono text-xs text-zinc-500">{history.length}</span>
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
        <p className="mt-2 font-mono text-xs leading-relaxed text-zinc-500">
          <span className="mr-2 font-sans text-zinc-600">Scramble</span>
          {scramble.map((move) => move.notation).join(' ')}
        </p>
      )}
      {history.length === 0 ? (
        <p className="mt-2 text-xs text-zinc-600">No moves yet. Press R, U or F, or drag a face of the cube.</p>
      ) : (
        <ol ref={list} className="mt-2 flex max-h-44 flex-wrap gap-x-2 gap-y-1 overflow-y-auto font-mono text-[13px]">
          {hidden > 0 && <li className="text-zinc-600">+{hidden} earlier</li>}
          {history.slice(-HISTORY_SHOWN).map((move, i, shown) => (
            <li key={hidden + i} className={i === shown.length - 1 ? 'text-zinc-50' : 'text-zinc-500'}>
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
    <div className="divide-y divide-line">
      <section aria-label="Algorithm" className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <Label>Algorithm</Label>
          {parsed.ok && (
            <span className="font-mono text-xs text-zinc-500">
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
            'mt-2.5 block w-full resize-none rounded-md border bg-base px-3 py-2 font-mono text-sm leading-relaxed text-zinc-50 placeholder:text-zinc-700 focus:outline-none',
            parsed.ok ? 'border-line focus:border-zinc-500' : 'border-red-500/60',
          )}
        />
        {!parsed.ok && (
          <div id="algorithm-error" role="alert" className="mt-2 text-xs leading-relaxed">
            <p className="text-red-300">
              {parsed.error.message} <span className="text-red-300/60">(character {parsed.error.index + 1})</span>
            </p>
            <code className="mt-1 block truncate font-mono text-zinc-500">
              {input.slice(0, parsed.error.index)}
              <mark className="rounded-sm bg-red-500/30 px-px text-red-100">{input[parsed.error.index] ?? ' '}</mark>
              {input.slice(parsed.error.index + 1)}
            </code>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5">
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
        <p className="mt-3 text-xs leading-relaxed text-zinc-600">
          Faces R L U D F B, slices M E S, wide r or Rw, rotations x y z. Add ' to reverse, 2 to double, and (R U)3 to
          repeat.
        </p>
      </section>
      <Transport />
      <History />
    </div>
  );
}
