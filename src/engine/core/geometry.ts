/**
 * Convex solids as lists of flat faces, and the one operation the geometric puzzles
 * are built from: cutting a solid with a plane. A puzzle's pieces are what is left
 * of its outer shape after every one of its cuts has been made.
 */
export type V3 = readonly [number, number, number];

/** A flat convex face. Its points run counter-clockwise seen from outside. `tag` is its colour, or -1 inside the puzzle. */
export interface Face {
  readonly points: readonly V3[];
  readonly tag: number;
}

export type Solid = readonly Face[];

const EPS = 1e-9;

export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const unit = (a: V3): V3 => scale(a, 1 / norm(a));

/** Twice the area of a polygon, as a vector along its outward normal. */
const areaVector = (points: readonly V3[]): V3 =>
  points.reduce<V3>((sum, p, i) => add(sum, cross(p, points[(i + 1) % points.length])), [0, 0, 0]);

export const normalOf = (face: Face): V3 => unit(areaVector(face.points));

const unique = (points: readonly V3[]): V3[] =>
  points.filter((p, i) => points.findIndex((q) => norm(sub(p, q)) < 1e-7) === i);

/** The middle of a solid: the average of its corners. Always inside, because the solid is convex. */
export function centroid(solid: Solid): V3 {
  const corners = unique(solid.flatMap((face) => face.points));
  return scale(corners.reduce(add, [0, 0, 0] as V3), 1 / corners.length);
}

/** The part of a polygon where n·p <= d. Points that land on the plane are also added to `rim`. */
export function trim(points: readonly V3[], n: V3, d: number, rim?: V3[]): V3[] {
  const kept: V3[] = [];
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    const da = dot(n, a) - d;
    const db = dot(n, b) - d;
    if (da <= EPS) kept.push(a);
    if (Math.abs(da) <= EPS) rim?.push(a);
    if ((da < -EPS && db > EPS) || (da > EPS && db < -EPS)) {
      const crossing = add(a, scale(sub(b, a), da / (da - db)));
      kept.push(crossing);
      rim?.push(crossing);
    }
  });
  return kept;
}

/**
 * The part of a convex solid where n·p <= d, closed off with a new face tagged `tag`.
 * Returns an empty solid when nothing of it lies on that side.
 */
export function clip(solid: Solid, n: V3, d: number, tag = -1): Solid {
  const rim: V3[] = [];
  const faces: Face[] = [];
  for (const face of solid) {
    const points = trim(face.points, n, d, rim);
    if (points.length >= 3 && norm(areaVector(points)) > 1e-10) faces.push({ points, tag: face.tag });
  }
  const onPlane = (face: Face) => face.points.every((p) => Math.abs(dot(n, p) - d) < 1e-7);
  // Only a face lying in the plane is left: the solid was on the far side, touching it at most.
  if (faces.every(onPlane)) return [];
  // A face already lying in the plane closes the solid there. Otherwise close the cut with the rim.
  const edge = unique(rim);
  if (edge.length >= 3 && !faces.some(onPlane)) {
    const middle = scale(edge.reduce(add, [0, 0, 0] as V3), 1 / edge.length);
    const u = unit(sub(edge[0], middle));
    const v = cross(n, u);
    const angle = (p: V3) => Math.atan2(dot(sub(p, middle), v), dot(sub(p, middle), u));
    const points = [...edge].sort((p, q) => angle(p) - angle(q));
    if (norm(areaVector(points)) > 1e-10) faces.push({ points, tag });
  }
  return faces;
}

/** The solid bounded by planes n·p <= d, each face tagged with its plane's colour. */
export function shell(planes: readonly { n: V3; d: number; colour: number }[]): Solid {
  // Start from a box far larger than any puzzle and cut it down to the shape.
  return planes.reduce((solid, plane) => clip(solid, unit(plane.n), plane.d / norm(plane.n), plane.colour), box(1e3));
}

function box(h: number): Solid {
  const corner = (x: number, y: number, z: number): V3 => [x * h, y * h, z * h];
  return [
    [corner(1, -1, -1), corner(1, 1, -1), corner(1, 1, 1), corner(1, -1, 1)],
    [corner(-1, -1, 1), corner(-1, 1, 1), corner(-1, 1, -1), corner(-1, -1, -1)],
    [corner(-1, 1, 1), corner(1, 1, 1), corner(1, 1, -1), corner(-1, 1, -1)],
    [corner(-1, -1, -1), corner(1, -1, -1), corner(1, -1, 1), corner(-1, -1, 1)],
    [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)],
    [corner(1, -1, -1), corner(-1, -1, -1), corner(-1, 1, -1), corner(1, 1, -1)],
  ].map((points) => ({ points, tag: -1 }));
}
