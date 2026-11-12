import { centreFrame, type CubeState, type Cubie } from './CubeState';
import { determinant, IDENTITY, multiply, sameValues, transform, transpose, type Vec3 } from './math';

/**
 * Checks that a state could have been reached by legal turns. Returns the rules it
 * breaks; an empty list means the state is valid.
 *
 * Structure (any size)
 *   - every orientation is a proper rotation, every cubie sits at rot · home, and
 *     no two cubies share a position.
 *
 * Reachability (the quantities every legal turn leaves unchanged)
 *   - corner twists add up to a multiple of 3;
 *   - 3×3: edge flips add up to an even number;
 *   - 3×3: the permutation of all 26 cubies is even, because a quarter turn is
 *     always two 4-cycles (corners + edges, or edges + centres);
 *   - 3×3: the six centres move together as one rigid frame.
 */
export function validateCube(state: CubeState, n: number): string[] {
  const max = n - 1;
  const problems: string[] = [];

  const positions = new Set<string>();
  for (const cubie of state) {
    const proper = sameValues(multiply(cubie.rot, transpose(cubie.rot)), IDENTITY) && determinant(cubie.rot) === 1;
    if (!proper) problems.push(`Cubie ${cubie.id} has an orientation that is not a rotation`);
    else if (!sameValues(cubie.pos, transform(cubie.rot, cubie.home)))
      problems.push(`Cubie ${cubie.id} is not where its orientation puts it`);
    positions.add(cubie.pos.join());
  }
  if (positions.size !== state.length) problems.push('Two cubies occupy the same position');
  // shortcut: reachability rules cover 2×2 and 3×3 only, add the 4×4 parity rules with a 4×4 engine.
  if (problems.length > 0 || n > 3) return problems;

  // A cubie with 3 outer sides is a corner, 2 an edge, 1 a centre.
  const outerSides = (cubie: Cubie) => cubie.home.filter((v) => Math.abs(v) === max).length;
  const sum = (cubies: CubeState, measure: (cubie: Cubie) => number) =>
    cubies.reduce((total, cubie) => total + measure(cubie), 0);

  if (sum(state.filter((c) => outerSides(c) === 3), cornerTwist) % 3 !== 0)
    problems.push('A corner is twisted in place (twists do not add up to a multiple of 3)');
  if (n === 3) {
    if (sum(state.filter((c) => outerSides(c) === 2), (c) => edgeFlip(c, max)) % 2 !== 0)
      problems.push('An edge is flipped in place (an odd number of edges are flipped)');
    if (!isEvenPermutation(state)) problems.push('Two pieces are swapped (the permutation is odd)');
    if (!centresAreRigid(state, n)) problems.push('The centres are in an arrangement no turn can produce');
  }
  return problems;
}

/**
 * Twist of a corner: how many clockwise steps, seen from outside the cube, its
 * up/down sticker is from the up/down face of the slot it sits in.
 */
function cornerTwist(corner: Cubie): number {
  // rot · ŷ is the middle column of rot; its nonzero row is the axis that sticker points along.
  const axis = [corner.rot[1], corner.rot[4], corner.rot[7]].findIndex((v) => v !== 0);
  if (axis === 1) return 0;
  // Clockwise around a corner the faces run y → x → z where x·y·z > 0, and y → z → x in the mirror-image slots.
  const mirrored = corner.pos[0] * corner.pos[1] * corner.pos[2] < 0;
  return (axis === 0) !== mirrored ? 1 : 2;
}

/**
 * An edge is flipped when its reference sticker is not on its slot's reference
 * face. The reference is the up/down one where it exists, front/back otherwise.
 */
function edgeFlip(edge: Cubie, max: number): number {
  const reference = (v: Vec3) => (Math.abs(v[1]) === max ? 1 : 2);
  const sticker = reference(edge.home);
  const facing = [edge.rot[sticker], edge.rot[3 + sticker], edge.rot[6 + sticker]].findIndex((v) => v !== 0);
  return facing === reference(edge.pos) ? 0 : 1;
}

function isEvenPermutation(state: CubeState): boolean {
  const owner = new Map(state.map((cubie) => [cubie.home.join(), cubie.id]));
  const visited = new Set<number>();
  let even = true;
  for (const start of state) {
    let length = 0;
    for (let c = start; !visited.has(c.id); c = state[owner.get(c.pos.join())!]) {
      visited.add(c.id);
      length++;
    }
    if (length > 0 && length % 2 === 0) even = !even; // a cycle of even length is an odd permutation
  }
  return even;
}

function centresAreRigid(state: CubeState, n: number): boolean {
  const frame = centreFrame(state, n);
  const centres = state.filter((c) => c.home.filter((v) => v === 0).length === 2);
  return determinant(frame) === 1 && centres.every((c) => sameValues(c.pos, transform(frame, c.home)));
}
