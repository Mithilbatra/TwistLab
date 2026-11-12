/**
 * Integer linear algebra for cube rotations.
 *
 * Every rotation a cube puzzle performs is a multiple of 90° about a coordinate
 * axis, so its matrix only ever holds -1, 0 and 1. Keeping the whole engine in
 * integers means the state after a million moves is exactly as precise as the
 * state after one: there is no floating-point error to accumulate.
 */
export type Vec3 = readonly [number, number, number];
/** Row-major 3×3 matrix. */
export type Mat3 = readonly number[];
export type Axis = 0 | 1 | 2;

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

// The trailing "+ 0" turns a -0 result into +0, so equal states always compare equal.
export function multiply(a: Mat3, b: Mat3): Mat3 {
  const out: number[] = [];
  for (let row = 0; row < 9; row += 3)
    for (let col = 0; col < 3; col++)
      out.push(a[row] * b[col] + a[row + 1] * b[col + 3] + a[row + 2] * b[col + 6] + 0);
  return out;
}

export function transform(m: Mat3, v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2] + 0,
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2] + 0,
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2] + 0,
  ];
}

export const transpose = (m: Mat3): Mat3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

export const determinant = (m: Mat3): number =>
  m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);

export const sameValues = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * +90° rotations about x, y and z by the right-hand rule: seen from the positive
 * end of the axis looking back at the origin, the turn is counter-clockwise.
 */
const QUARTER: readonly Mat3[] = [
  [1, 0, 0, 0, 0, -1, 0, 1, 0],
  [0, 0, 1, 0, 1, 0, -1, 0, 0],
  [0, -1, 0, 1, 0, 0, 0, 0, 1],
];

/** Exact rotation by `turns` quarter turns about `axis`. Negative turns are clockwise seen from the positive end. */
export function quarterTurns(axis: Axis, turns: number): Mat3 {
  let m = IDENTITY;
  for (let i = ((turns % 4) + 4) % 4; i > 0; i--) m = multiply(QUARTER[axis], m);
  return m;
}
