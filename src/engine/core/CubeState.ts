import { IDENTITY, multiply, quarterTurns, transform, type Mat3, type Vec3 } from './math';
import { layerCoords, type Move } from './Move';

/**
 * A cubie is a rigid body: the engine tracks where it is and how it is turned, and
 * nothing else. Sticker colours are never stored or shuffled. A sticker is simply
 * whichever home face of the cubie currently points outwards.
 */
export interface Cubie {
  /** Index in the state array; stable for the life of the puzzle. */
  readonly id: number;
  /** Position in the solved cube. */
  readonly home: Vec3;
  /** Current position. Always equal to `rot · home`. */
  readonly pos: Vec3;
  /** Current orientation as a rotation matrix (identity when solved). */
  readonly rot: Mat3;
}

export type CubeState = readonly Cubie[];

/** The visible cubies of an n×n×n cube, solved: 26 for a 3×3, 8 for a 2×2. */
export function createSolvedCube(n: number): CubeState {
  const coords = layerCoords(n);
  const cubies: Cubie[] = [];
  for (const x of coords)
    for (const y of coords)
      for (const z of coords)
        if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === n - 1)
          cubies.push({ id: cubies.length, home: [x, y, z], pos: [x, y, z], rot: IDENTITY });
  return cubies;
}

/**
 * Turns every cubie in the move's layers about the origin. Position and orientation
 * get the same rotation, which is what keeps each cubie rigid.
 */
export function applyMove(state: CubeState, move: Move): CubeState {
  const rotation = quarterTurns(move.axis, move.turns);
  return state.map((cubie) =>
    move.layers.includes(cubie.pos[move.axis])
      ? { ...cubie, pos: transform(rotation, cubie.pos), rot: multiply(rotation, cubie.rot) }
      : cubie,
  );
}

export const applyMoves = (state: CubeState, moves: readonly Move[]): CubeState =>
  moves.reduce((current, move) => applyMove(current, move), state);

/**
 * Solved means every face shows one colour, not that every cubie is home. A cube
 * rotated as a whole (x, y, z) is still solved, and so is one whose centres have
 * been twisted in place, which no sticker can show.
 *
 * So the test is: all stickers that started on one face still point the same way.
 */
export function isSolved(state: CubeState, n: number): boolean {
  const facing: string[] = [];
  for (const cubie of state)
    for (let axis = 0; axis < 3; axis++) {
      const side = cubie.home[axis];
      if (Math.abs(side) !== n - 1) continue; // no sticker on this side of the cubie
      const normal: [number, number, number] = [0, 0, 0];
      normal[axis] = Math.sign(side);
      const direction = transform(cubie.rot, normal).join();
      const face = axis * 2 + (side > 0 ? 0 : 1);
      if ((facing[face] ??= direction) !== direction) return false;
    }
  return true;
}

/**
 * How an odd cube is turned as a whole, read off its centres: the rotation that
 * carries each centre from home to where it is now. Any other piece is solved
 * exactly when its own orientation equals this frame.
 */
export function centreFrame(state: CubeState, n: number): Mat3 {
  const max = n - 1;
  const image = (axis: number): Vec3 =>
    state.find((c) => c.home[axis] === max && c.home.filter((v) => v === 0).length === 2)!.pos;
  const [x, y, z] = [image(0), image(1), image(2)];
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]].map((v) => v / max);
}
