import { useState } from 'react';
import { histogram, type Bin } from '../../utils/stats';

const range = (bin: Bin) => `${bin.from / 1000}–${bin.to / 1000}s`;
const solves = (count: number) => `${count} ${count === 1 ? 'solve' : 'solves'}`;

/**
 * Histogram of solve times. One series, so one colour and no legend; the solve list
 * below it is the table view of the same data. Each bar's whole column is its hover
 * and focus target, and the readout above the plot names the bar being pointed at.
 */
export function Distribution({ times }: { times: readonly number[] }) {
  const [focused, setFocused] = useState<Bin | null>(null);
  if (times.length < 3)
    return <p className="mt-2 text-xs text-zinc-600">After three solves the spread of your times shows up here.</p>;

  const bins = histogram(times);
  const peak = bins.reduce((a, b) => (b.count > a.count ? b : a));
  const shown = focused ?? peak;

  return (
    <figure className="mt-1">
      <p className="text-right text-[11px] text-zinc-400" aria-hidden="true">
        {focused ? '' : 'Most often '}
        <span className="font-mono text-zinc-200">{range(shown)}</span> · {solves(shown.count)}
      </p>
      <ul className="mt-2 flex h-24 items-end gap-0.5 border-b border-line" onMouseLeave={() => setFocused(null)}>
        {bins.map((bin) => (
          <li
            key={bin.from}
            tabIndex={0}
            aria-label={`${range(bin)}: ${solves(bin.count)}`}
            className="group flex h-full flex-1 items-end justify-center rounded-t outline-offset-0"
            onMouseEnter={() => setFocused(bin)}
            onFocus={() => setFocused(bin)}
            onBlur={() => setFocused(null)}
          >
            <div
              className="w-full max-w-6 rounded-t bg-accent/70 transition-colors group-hover:bg-accent group-focus-visible:bg-accent"
              style={{ height: `${(bin.count / peak.count) * 100}%`, minHeight: bin.count > 0 ? 2 : 0 }}
            />
          </li>
        ))}
      </ul>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-zinc-600">
        <span>{bins[0].from / 1000}s</span>
        <span>{bins[bins.length - 1].to / 1000}s</span>
      </figcaption>
    </figure>
  );
}
