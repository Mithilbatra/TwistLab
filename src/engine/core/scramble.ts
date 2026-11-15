import { createMove, type Move, type MoveTable } from './Move';

/**
 * Random-move scramble. Built only from legal turns, so the result is always a
 * reachable state. Consecutive turns never cancel or merge: no face twice in a
 * row, and no third turn on an axis (R L R).
 *
 * shortcut: random-move, not WCA random-state. Upgrade when a solver exists to
 * generate scrambles from uniformly random positions.
 */
export function generateScramble(n: number, table: MoveTable, random: () => number = Math.random): Move[] {
  // A 2×2 needs only three faces: turning L is the same as turning R and rotating the cube.
  const faces = n === 2 ? ['R', 'U', 'F'] : ['R', 'L', 'U', 'D', 'F', 'B'];
  // Bigger cubes add wide turns, as competition scrambles do: two deep from 4×4, three deep from 6×6.
  // On an even cube a wide turn from one side is its opposite plus a rotation, so three of them are enough.
  const wide = (depth: string) => (n % 2 === 0 ? ['r', 'u', 'f'] : ['r', 'l', 'u', 'd', 'f', 'b']).map((face) => depth + face);
  const bases = [...faces, ...(n >= 4 ? wide('') : []), ...(n >= 6 ? wide('3') : [])];
  const length = n === 2 ? 10 : (n - 2) * 20; // 20, 40, 60, 80 and 100 moves: the lengths competitions use
  const moves: Move[] = [];
  while (moves.length < length) {
    const base = bases[Math.floor(random() * bases.length)];
    const last = moves.at(-1);
    const sameAxisRun = last?.axis === table[base].axis && moves.at(-2)?.axis === last.axis;
    if (last?.base === base || sameAxisRun) continue;
    const variant = Math.floor(random() * 3);
    moves.push(createMove(base, table[base], variant === 2, variant === 1));
  }
  return moves;
}
