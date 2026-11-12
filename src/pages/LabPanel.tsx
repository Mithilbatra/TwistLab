import { useState } from 'react';
import { Play, Star } from 'lucide-react';
import { Transport } from '../components/algorithm/Transport';
import { Button, cx, IconButton, Label, Stickers } from '../components/ui/ui';
import { ALGORITHMS, CATEGORIES, type Algorithm, type Category } from '../engine/algorithms/AlgorithmLibrary';
import { demoSetup, demoStrip, parse3x3 } from '../engine/algorithms/lessons';
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
  const strip = demoStrip(algorithm.notation);
  return (
    <li className={cx('relative px-4 py-3.5 transition-colors', active && 'bg-accent/[0.08]')}>
      {active && <span aria-hidden="true" className="absolute inset-y-2.5 left-0 w-1 rounded-r bg-accent" />}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-zinc-50">{algorithm.name}</h3>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted uppercase">
          <span className="flex gap-0.5" aria-hidden="true">
            {[1, 2, 3].map((level) => (
              <span key={level} className={cx('size-1.5 rounded-[1px]', level <= algorithm.difficulty ? 'bg-accent' : 'bg-white/15')} />
            ))}
          </span>
          {DIFFICULTY[algorithm.difficulty]}
        </span>
        <span className="ml-auto font-mono text-[10px] font-medium tracking-[0.12em] text-faint uppercase">{algorithm.categories[0]}</span>
        <IconButton
          label={favourite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={favourite}
          className="-mr-2"
          onClick={() => useAlgorithm.getState().toggleFavourite(algorithm.id)}
        >
          <Star className={favourite ? 'fill-cube-yellow text-cube-yellow' : undefined} />
        </IconButton>
      </div>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">{algorithm.description}</p>
      <div className="mt-2.5 flex items-start gap-3 pb-1">
        <Stickers moves={strip.moves} faces={strip.faces} className="min-w-0 flex-1 pt-1" />
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
      <section className="border-b border-dotted border-white/20 px-4 pt-4 pb-4">
        <div className="flex items-baseline justify-between">
          <Label>Algorithms</Label>
          <span className="font-mono text-xs text-muted">{shown.length}</span>
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
                tab === name ? 'bg-accent font-semibold text-accent-ink' : 'bg-white/[0.06] text-zinc-400 hover:bg-white/[0.11] hover:text-zinc-100',
              )}
            >
              {name === 'Favourites' && <Star size={12} className={favourites.length > 0 ? 'fill-current' : undefined} />}
              {name}
            </button>
          ))}
        </div>
        {!is3x3 && (
          <p className="mt-3 text-xs text-muted">These are 3×3 algorithms. Running one switches to the 3×3.</p>
        )}
      </section>
      {/* Stays in view while the list scrolls, so the steps are visible whichever row was run. */}
      <div className="sticky top-0 z-10 border-b border-dotted border-white/25 bg-panel empty:hidden">
        <Transport />
      </div>
      {shown.length === 0 ? (
        <p className="mx-4 my-4 rounded-lg border border-dotted border-white/20 px-3 py-4 text-muted">
          No favourites yet. Star an algorithm to keep it here.
        </p>
      ) : (
        <ul className="divide-y divide-dotted divide-white/20">
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
