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
  const length = n === 2 ? 10 : 20;
  const moves: Move[] = [];
  while (moves.length < length) {
    const base = faces[Math.floor(random() * faces.length)];
    const last = moves.at(-1);
    const sameAxisRun = last?.axis === table[base].axis && moves.at(-2)?.axis === last.axis;
    if (last?.base === base || sameAxisRun) continue;
    const variant = Math.floor(random() * 3);
    moves.push(createMove(base, table[base], variant === 2, variant === 1));
  }
  return moves;
}
