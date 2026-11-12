/** Formats milliseconds the way timers show them: 9.87, 1:02.45. Hundredths are truncated, as in WCA results. */
export function formatTime(ms: number): string {
  const hundredths = Math.floor(ms / 10);
  const minutes = Math.floor(hundredths / 6000);
  const seconds = ((hundredths % 6000) / 100).toFixed(2);
  return minutes > 0 ? `${minutes}:${seconds.padStart(5, '0')}` : seconds;
}

/** WCA-style average of the last `n` times: drop the best and the worst, then average the rest. */
export function averageOf(times: readonly number[], n: number): number | null {
  if (times.length < n) return null;
  const middle = times
    .slice(-n)
    .sort((a, b) => a - b)
    .slice(1, -1);
  return middle.reduce((sum, time) => sum + time, 0) / middle.length;
}

export interface Bin {
  from: number;
  to: number;
  count: number;
}

/** Groups times into equal bins a whole number of seconds wide, for the distribution chart. */
export function histogram(times: readonly number[], maxBins = 10): Bin[] {
  if (times.length === 0) return [];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const width = Math.max(1, Math.ceil((max - min) / 1000 / maxBins)) * 1000;
  const start = Math.floor(min / width) * width;
  const bins: Bin[] = [];
  for (let from = start; from <= max; from += width) bins.push({ from, to: from + width, count: 0 });
  for (const time of times) bins[Math.floor((time - start) / width)].count++;
  return bins;
}
