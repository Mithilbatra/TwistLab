import type { Axis } from './math';

/**
 * One turn of one or more parallel layers.
 *
 * `turns` is the signed number of quarter turns about the positive axis (right-hand
 * rule). R is clockwise when you look at the right face, which makes it -1 about +x.
 */
export interface Move {
  /** Letter as written in notation: R, r, M, x … */
  readonly base: string;
  readonly axis: Axis;
  /** Coordinates along `axis` of the layers that turn. */
  readonly layers: readonly number[];
  readonly turns: number;
  readonly notation: string;
}

/** How a letter maps onto the cube: which layers turn, and which way a plain (unprimed) turn goes. */
export interface MoveDef {
  readonly axis: Axis;
  readonly layers: readonly number[];
  readonly direction: 1 | -1;
}

export type MoveTable = Readonly<Record<string, MoveDef>>;

/** Layer coordinates along any axis: -(n-1) … n-1 in steps of 2, so they are integers for every n. */
export const layerCoords = (n: number): number[] => Array.from({ length: n }, (_, i) => 2 * i - (n - 1));

export function createMoveTable(n: number): MoveTable {
  const max = n - 1;
  const table: Record<string, MoveDef> = {
    R: { axis: 0, layers: [max], direction: -1 },
    L: { axis: 0, layers: [-max], direction: 1 },
    U: { axis: 1, layers: [max], direction: -1 },
    D: { axis: 1, layers: [-max], direction: 1 },
    F: { axis: 2, layers: [max], direction: -1 },
    B: { axis: 2, layers: [-max], direction: 1 },
    // Whole-cube rotations follow R, U and F.
    x: { axis: 0, layers: layerCoords(n), direction: -1 },
    y: { axis: 1, layers: layerCoords(n), direction: -1 },
    z: { axis: 2, layers: layerCoords(n), direction: -1 },
  };
  if (n % 2 === 1) {
    // Only an odd cube has a middle layer. The slices follow L, D and F.
    table.M = { axis: 0, layers: [0], direction: 1 };
    table.E = { axis: 1, layers: [0], direction: 1 };
    table.S = { axis: 2, layers: [0], direction: -1 };
  }
  for (const face of 'RLUDFB') {
    const { axis, layers, direction } = table[face];
    // The layer `depth` deep behind this face: depth 1 is the face itself. The "+ 0" keeps a middle layer at 0, not -0.
    const layer = (depth: number) => Math.sign(layers[0]) * (max - 2 * (depth - 1)) + 0;
    // A wide move takes the face and the layers behind it: r is two deep, 3r three.
    for (let depth = 2; depth < n; depth++)
      table[(depth > 2 ? depth : '') + face.toLowerCase()] = {
        axis,
        layers: Array.from({ length: depth }, (_, i) => layer(i + 1)),
        direction,
      };
    // An inner layer on its own is named by its depth from the nearer face: 2R.
    for (let depth = 2; depth <= n / 2; depth++) table[depth + face] = { axis, layers: [layer(depth)], direction };
  }
  return table;
}

export function createMove(base: string, def: MoveDef, double: boolean, prime: boolean): Move {
  return {
    base,
    axis: def.axis,
    layers: def.layers,
    turns: def.direction * (prime ? -1 : 1) * (double ? 2 : 1),
    notation: base + (double ? '2' : prime ? "'" : ''),
  };
}

export function invertMove(move: Move): Move {
  const suffix = Math.abs(move.turns) === 2 ? '2' : move.notation.endsWith("'") ? '' : "'";
  return { ...move, turns: -move.turns, notation: move.base + suffix };
}

/** The sequence that undoes `moves`: reversed order, each move inverted. */
export const invertMoves = (moves: readonly Move[]): Move[] => moves.map(invertMove).reverse();

export const formatMoves = (moves: readonly Move[]): string => moves.map((move) => move.notation).join(' ');

/** The named move that turns the single layer at `coord` by one quarter turn, if the puzzle has one. */
export function moveForLayer(table: MoveTable, axis: Axis, coord: number, turns: number): Move | null {
  for (const [base, def] of Object.entries(table))
    if (def.axis === axis && def.layers.length === 1 && def.layers[0] === coord)
      return createMove(base, def, false, turns !== def.direction);
  return null;
}
