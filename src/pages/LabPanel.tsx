import { useState } from 'react';
import { Play, Star } from 'lucide-react';
import { Transport } from '../components/algorithm/Transport';
import { Button, cx, IconButton, Label } from '../components/ui/ui';
import { ALGORITHMS, CATEGORIES, type Algorithm, type Category } from '../engine/algorithms/AlgorithmLibrary';
import { demoSetup, parse3x3 } from '../engine/algorithms/lessons';
import { useAlgorithm } from '../store/algorithmStore';
import { useCube } from '../store/cubeStore';

const DIFFICULTY = ['', 'Easy', 'Moderate', 'Demanding'];

/** Shows an algorithm at work: sets up the position it solves, then plays it step by step. */
function runDemo(algorithm: Algorithm) {
  useCube.getState().setPuzzle('3x3');
  const moves = parse3x3(algorithm.notation);
  const playback = useAlgorithm.getState();
  playback.open(moves, { title: algorithm.name, setup: demoSetup(moves) });
  void playback.play();
}

function AlgorithmRow({ algorithm, favourite, active }: { algorithm: Algorithm; favourite: boolean; active: boolean }) {
  return (
    <li className={cx('px-4 py-3.5 transition-colors', active && 'bg-white/[0.04]')}>
      <div className="flex items-center gap-2">
        <h3 className="font-medium text-zinc-50">{algorithm.name}</h3>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <span className="flex gap-0.5" aria-hidden="true">
            {[1, 2, 3].map((level) => (
              <span key={level} className={cx('h-2.5 w-0.5 rounded-full', level <= algorithm.difficulty ? 'bg-zinc-300' : 'bg-white/15')} />
            ))}
          </span>
          {DIFFICULTY[algorithm.difficulty]}
        </span>
        <span className="ml-auto text-[10px] font-medium tracking-[0.12em] text-zinc-600 uppercase">{algorithm.categories[0]}</span>
        <IconButton
          label={favourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={favourite}
          className="-mr-2"
          onClick={() => useAlgorithm.getState().toggleFavourite(algorithm.id)}
        >
          <Star className={favourite ? 'fill-accent text-accent' : undefined} />
        </IconButton>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">{algorithm.description}</p>
      <div className="mt-2.5 flex items-center gap-3">
        <code className="min-w-0 flex-1 font-mono text-[13px] leading-relaxed text-zinc-200">{algorithm.notation}</code>
        <Button aria-label={`Execute ${algorithm.name}`} onClick={() => runDemo(algorithm)}>
          <Play />
          Execute
        </Button>
      </div>
    </li>
  );
}

export function LabPanel() {
  const [tab, setTab] = useState<Category | 'Favourites'>('OLL');
  const favourites = useAlgorithm((s) => s.favourites);
  const activeTitle = useAlgorithm((s) => s.title);
  const is3x3 = useCube((s) => s.puzzleId === '3x3');
  const shown = ALGORITHMS.filter((algorithm) =>
    tab === 'Favourites' ? favourites.includes(algorithm.id) : algorithm.categories.includes(tab),
  );

  return (
    <div>
      <section className="px-4 pt-4 pb-3">
        <div className="flex items-baseline justify-between">
          <Label>Algorithm Lab</Label>
          <span className="font-mono text-xs text-zinc-500">{shown.length}</span>
        </div>
        <div role="tablist" aria-label="Categories" className="mt-3 flex flex-wrap gap-1">
          {(['Favourites', ...CATEGORIES] as const).map((name) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={tab === name}
              onClick={() => setTab(name)}
              className={cx(
                'flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors',
                tab === name ? 'bg-white/10 text-zinc-50' : 'text-zinc-500 hover:bg-white/[0.05] hover:text-zinc-200',
              )}
            >
              {name === 'Favourites' && <Star size={12} className={favourites.length > 0 ? 'fill-accent text-accent' : undefined} />}
              {name}
            </button>
          ))}
        </div>
        {!is3x3 && (
          <p className="mt-3 text-xs text-zinc-500">These are 3×3 algorithms. Running one switches to the 3×3.</p>
        )}
      </section>
      {/* Stays in view while the list scrolls, so the steps are visible whichever row was run. */}
      <div className="sticky top-0 z-10 border-y border-line bg-panel empty:hidden">
        <Transport />
      </div>
      {shown.length === 0 ? (
        <p className="px-4 py-6 text-zinc-500">No favourites yet. Star an algorithm to keep it here.</p>
      ) : (
        <ul className="divide-y divide-line">
          {shown.map((algorithm) => (
            <AlgorithmRow
              key={algorithm.id}
              algorithm={algorithm}
              favourite={favourites.includes(algorithm.id)}
              active={activeTitle === algorithm.name}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
