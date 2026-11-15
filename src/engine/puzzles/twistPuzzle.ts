import { add, centroid, clip, cross, dot, norm, normalOf, scale, shell, sub, trim, unit, type Solid, type V3 } from '../core/geometry';
import { parseSequence, PRIMES, SyntaxProblem } from '../core/MoveParser';
import type { PieceMesh, PieceModel, Puzzle, PuzzleInfo } from './PuzzleEngine';

/**
 * A puzzle described by its geometry: an outer shape, the directions it turns
 * about, and the cuts that separate what turns from what stays. Everything else
 * follows from that description: the pieces are whatever the cuts leave of the
 * shape, and a move turns the pieces lying on its side of a cut.
 *
 * This is how every puzzle that is not a plain n×n×n cube is defined. A Pyraminx
 * turns in thirds about its four corners, a Megaminx in fifths about twelve faces,
 * a Mirror Cube in quarters about three axes that miss the middle of its box.
 */
export interface TwistDef extends PuzzleInfo {
  readonly id: string;
  readonly label: string;
  readonly help: string;
  readonly moveNames?: Readonly<Record<string, string>>;
  /** The outer shape: the planes n·p <= d that bound it, each with the colour of its face. */
  readonly shell: readonly { n: V3; d: number; colour: number }[];
  /** The directions it turns about, and how many turns bring a layer back round. */
  readonly axes: readonly { dir: V3; order: number }[];
  /**
   * The turns, by name. Each takes the pieces between two depths along its axis
   * (lo < depth <= hi, open-ended by default). A plain turn is clockwise seen
   * from the far end of the axis.
   */
  readonly moves: Readonly<Record<string, { axis: number; lo?: number; hi?: number }>>;
  /** Turns of the whole puzzle. They change the view, not the puzzle, so they are not counted. */
  readonly rotations?: readonly string[];
  /** Moves written as a fixed word rather than a name and a suffix, such as R++ on a Megaminx. */
  readonly words?: Readonly<Record<string, readonly [name: string, turns: number]>>;
  /** 'colours': every face shows one colour (the default). 'shape': the outline is restored, for puzzles solved by shape. */
  readonly solvedBy?: 'colours' | 'shape';
  /** Scrambles: `length` turns drawn from `from`, then one turn or none of each move in `then`. Or a function, for a fixed format. */
  readonly scramble:
    | { from: readonly string[]; length: number; then?: readonly string[] }
    | ((random: () => number, move: (name: string, turns: number) => TwistMove) => TwistMove[]);
}

/** `turns` counts clockwise steps of the move's axis, kept to the short way round: -1 rather than +3. */
export interface TwistMove {
  readonly name: string;
  readonly turns: number;
  readonly notation: string;
}

/**
 * One number per piece: which rotation of the puzzle's symmetry group has been
 * applied to it since solved. Position is not stored, it follows from the rotation.
 * The numbers index a table built once, and turning a piece is a table lookup, so
 * a state is exact however many moves made it.
 */
export type TwistState = readonly number[];

export type TwistPuzzle = Puzzle<TwistState, TwistMove>;

type M3 = readonly number[];
const IDENTITY: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// Entries of these matrices that should be 0, ±1/2 or ±1 are set to exactly that. The "+ 0" turns -0 into 0.
const snap = (v: number) => (Math.abs(v - Math.round(v * 2) / 2) < 1e-9 ? Math.round(v * 2) / 2 + 0 : v);
const turned = (m: M3, v: V3): V3 => [
  m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
  m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
  m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
];
const product = (a: M3, b: M3): M3 =>
  IDENTITY.map((_, i) => snap(a[i - (i % 3)] * b[i % 3] + a[i - (i % 3) + 1] * b[(i % 3) + 3] + a[i - (i % 3) + 2] * b[(i % 3) + 6]));
/** Rotation by `angle` about the unit vector `u`, counter-clockwise seen from its tip. */
function rotation([x, y, z]: V3, angle: number): M3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c].map(snap);
}
/** Text that is the same for numbers that differ only by rounding error. */
const key = (values: readonly number[]) => values.map((v) => Math.round(v * 1e4)).join();
const modulo = (value: number, n: number) => ((value % n) + n) % n;

// Sizes for drawing, in the stage's units: the gap around a piece, a sticker's margin, and the rounding of its corners.
const GAP = 0.014;
const MARGIN = 0.05;
const ROUND = 0.07;

/** A piece as triangles: its body drawn slightly small, and a sticker standing proud of it on each outer face. */
export function meshOf(cell: Solid, unitSize: number): PieceMesh {
  const positions: number[] = [];
  const tags: number[] = [];
  const fan = (points: readonly V3[], tag: number) => {
    for (let k = 1; k < points.length - 1; k++)
      for (const p of [points[0], points[k], points[k + 1]]) {
        positions.push(...p);
        tags.push(tag);
      }
  };
  const planes = cell.map((face) => ({ face, n: normalOf(face) }));
  const body = planes.reduce((solid, { face, n }) => clip(solid, n, dot(n, face.points[0]) - GAP * unitSize), cell);
  for (const face of body) fan(face.points, -1);
  for (const { face, n } of planes) {
    if (face.tag < 0) continue;
    let sticker = [...face.points];
    face.points.forEach((a, k) => {
      const edge = sub(face.points[(k + 1) % face.points.length], a);
      if (norm(edge) < 1e-7) return;
      const inward = cross(n, unit(edge));
      sticker = trim(sticker, scale(inward, -1), -(dot(inward, a) + MARGIN * unitSize));
    });
    if (sticker.length < 3) continue;
    // Round each corner off with a short curve.
    fan(
      sticker.flatMap((b, k) => {
        const a = sticker[(k + sticker.length - 1) % sticker.length];
        const c = sticker[(k + 1) % sticker.length];
        const r = Math.min(ROUND * unitSize, norm(sub(a, b)) / 2.5, norm(sub(c, b)) / 2.5);
        const p = add(b, scale(unit(sub(a, b)), r));
        const q = add(b, scale(unit(sub(c, b)), r));
        return [p, add(scale(add(p, q), 0.25), scale(b, 0.5)), q];
      }),
      face.tag,
    );
  }
  return { positions, tags };
}

export function createTwistPuzzle(def: TwistDef): TwistPuzzle {
  const axes = def.axes.map((axis) => ({ dir: unit(axis.dir), order: axis.order }));
  const named = Object.fromEntries(
    Object.entries(def.moves).map(([name, move]) => [name, { axis: move.axis, lo: move.lo ?? -Infinity, hi: move.hi ?? Infinity }]),
  );

  // Every rotation the puzzle can apply to a piece: the group generated by one clockwise step of each axis.
  const steps = axes.map(({ dir, order }) => Array.from({ length: order }, (_, k) => rotation(dir, (-2 * Math.PI * k) / order)));
  const rots: M3[] = [IDENTITY];
  const indexOf = new Map([[key(IDENTITY), 0]]);
  for (let i = 0; i < rots.length; i++)
    for (const step of steps) {
      const next = product(step[1], rots[i]);
      if (!indexOf.has(key(next))) {
        indexOf.set(key(next), rots.length);
        rots.push(next);
      }
    }
  const compose = rots.map((a) => rots.map((b) => indexOf.get(key(product(a, b)))!));
  const stepIndex = steps.map((axis) => axis.map((step) => indexOf.get(key(step))!));

  // The pieces: what is left of the shape after every cut. Two moves may share a cut, so each plane is made once.
  const cuts = new Map<string, { n: V3; d: number }>();
  for (const { axis, lo, hi } of Object.values(named))
    for (const depth of [lo, hi]) {
      if (!Number.isFinite(depth)) continue;
      const flip = axes[axis].dir.find((v) => Math.abs(v) > 1e-9)! < 0 ? -1 : 1;
      const plane = { n: scale(axes[axis].dir, flip), d: depth * flip };
      cuts.set(key([...plane.n, plane.d]), plane);
    }
  let cells: Solid[] = [shell(def.shell)];
  for (const { n, d } of cuts.values())
    cells = cells.flatMap((cell) => [clip(cell, n, d), clip(cell, scale(n, -1), -d)].filter((part) => part.length >= 4));
  const pieces = cells.map((cell) => ({
    cell,
    centre: centroid(cell),
    stickers: cell.filter((face) => face.tag >= 0).map((face) => ({ colour: face.tag, normal: normalOf(face), points: face.points })),
  }));
  const solved: TwistState = pieces.map(() => 0);
  /** Which side of every cut a point is on: the name of the slot it lies in. */
  const slotOf = (p: V3) => [...cuts.values()].map(({ n, d }) => (dot(n, p) > d ? 1 : 0)).join('');
  const slots = new Set(pieces.map((piece) => slotOf(piece.centre)));

  const riders = (state: TwistState, name: string): boolean[] => {
    const { axis, lo, hi } = named[name];
    return pieces.map((piece, i) => {
      const depth = dot(turned(rots[state[i]], piece.centre), axes[axis].dir);
      return depth > lo && depth <= hi;
    });
  };

  const make = (name: string, turns: number): TwistMove => {
    const { order } = axes[named[name].axis];
    let short = modulo(turns, order);
    if (short > order / 2) short -= order;
    const word = Object.entries(def.words ?? {}).find(([, [of, by]]) => of === name && by === short)?.[0];
    const size = Math.abs(short);
    return { name, turns: short, notation: word ?? name + (size > 1 ? size : '') + (short < 0 ? "'" : '') };
  };

  // The longest name wins, so that BR is one move and not B followed by R.
  const tokens = [...Object.keys(def.words ?? {}), ...Object.keys(named)].sort((a, b) => b.length - a.length);
  const example = Object.keys(named)[0];
  const read = (input: string, start: number) => {
    const head = String.fromCodePoint(input.codePointAt(start)!);
    if (/\d/.test(head))
      throw new SyntaxProblem(`"${head}" has no move before it. A number goes right after a move, as in ${example}2`, start);
    if (PRIMES.includes(head))
      throw new SyntaxProblem(`"${head}" has no move before it. A prime goes right after a move, as in ${example}'`, start);
    const token = tokens.find((candidate) => input.startsWith(candidate, start));
    if (!token)
      throw new SyntaxProblem(`"${head}" is not a move on this puzzle. It turns ${Object.keys(named).slice(0, 12).join(' ')}`, start);
    let i = start + token.length;
    const word = def.words?.[token];
    if (word) return { move: make(word[0], word[1]), end: i };

    const { order } = axes[named[token].axis];
    let prime = false;
    if (PRIMES.includes(input[i] ?? ' ')) {
      prime = true;
      i++;
    }
    const digits = /^\d*/.exec(input.slice(i))![0];
    i += digits.length;
    const amount = digits === '' ? 1 : Number(digits);
    if (amount < 1 || amount >= order)
      throw new SyntaxProblem(
        `"${token}${digits}" is not a turn. ${token} comes back round after ${order}, so use ${token}${order > 3 ? `, ${token}2` : ''} or ${token}'`,
        start,
      );
    if (!prime && PRIMES.includes(input[i] ?? ' ')) {
      prime = true;
      i++;
    }
    return { move: make(token, prime ? -amount : amount), end: i };
  };

  const scramble = (random: () => number = Math.random): TwistMove[] => {
    if (typeof def.scramble === 'function') return def.scramble(random, make);
    const { from, length, then = [] } = def.scramble;
    const moves: TwistMove[] = [];
    while (moves.length < length) {
      const name = from[Math.floor(random() * from.length)];
      const last = moves.at(-1);
      if (last && named[last.name].axis === named[name].axis) continue; // two turns of one axis would merge into one
      moves.push(make(name, 1 + Math.floor(random() * (axes[named[name].axis].order - 1))));
    }
    for (const name of then) {
      const turns = Math.floor(random() * axes[named[name].axis].order);
      if (turns > 0) moves.push(make(name, turns));
    }
    return moves;
  };

  // Solved by colour: all the stickers of one colour face the same way. That holds however the whole puzzle is turned.
  const oneColourPerFace = (state: TwistState): boolean => {
    const facing: string[] = [];
    for (let i = 0; i < pieces.length; i++)
      for (const sticker of pieces[i].stickers) {
        const way = key(turned(rots[state[i]], sticker.normal));
        if ((facing[sticker.colour] ??= way) !== way) return false;
      }
    return true;
  };

  // Solved by shape: the outside of the puzzle, every corner of every outer face, is where it is on a solved puzzle
  // turned some way round. Pieces that look alike may trade places, and a piece may sit any way that looks the same.
  const looks = new Map<number, string>();
  const look = (piece: number, rot: number): string => {
    const id = piece * rots.length + rot;
    let text = looks.get(id);
    if (text === undefined) {
      text = pieces[piece].stickers
        .map((sticker) => `${sticker.colour}:${sticker.points.map((p) => key(turned(rots[rot], p))).sort().join(';')}`)
        .sort()
        .join('|');
      looks.set(id, text);
    }
    return text;
  };
  const outline = (state: TwistState) => state.map((rot, piece) => look(piece, rot)).sort().join('/');
  let solvedOutlines: Set<string> | undefined;
  const shapeRestored = (state: TwistState): boolean => {
    solvedOutlines ??= new Set(rots.map((_, rot) => outline(pieces.map(() => rot))));
    return solvedOutlines.has(outline(state));
  };

  const corners = pieces.flatMap((piece) => piece.stickers.flatMap((sticker) => sticker.points));
  const size = 2.6 / Math.max(...corners.map(norm));
  let meshes: PieceMesh[] | undefined;
  const model: PieceModel<TwistState, TwistMove> = {
    kind: 'pieces',
    scale: size,
    // A puzzle that does not reach as far down as a cube is lowered until it does.
    drop: Math.max(0, Math.min(...corners.map((p) => p[1])) * size + 1.5),
    get pieces() {
      return (meshes ??= pieces.map((piece) => meshOf(piece.cell, 1 / size)));
    },
    pose: (state, i) => rots[state[i]],
    turning: (state, move) => {
      const { dir, order } = axes[named[move.name].axis];
      return [{ axis: dir, angle: (-2 * Math.PI * move.turns) / order, moving: riders(state, move.name) }];
    },
    grips: (state, i) => {
      // Of the turns about one line that take this piece, the one that takes the fewest pieces with it.
      const best = new Map<string, { name: string; count: number }>();
      for (const name of Object.keys(named)) {
        if (def.rotations?.includes(name)) continue;
        const moving = riders(state, name);
        if (!moving[i]) continue;
        const { dir } = axes[named[name].axis];
        const line = key(scale(dir, dir.find((v) => Math.abs(v) > 1e-9)! < 0 ? -1 : 1));
        const count = moving.filter(Boolean).length;
        // A drag turns a layer. A turn that carries most of the puzzle (R++ on a Megaminx) is never what was meant.
        if (count * 2 > pieces.length) continue;
        if (count < (best.get(line)?.count ?? Infinity)) best.set(line, { name, count });
      }
      // A plain turn is clockwise, which is the negative way round its axis.
      return [...best.values()].map(({ name }) => ({
        axis: axes[named[name].axis].dir,
        turn: (direction: 1 | -1) => make(name, -direction),
      }));
    },
  };

  return {
    id: def.id,
    name: def.name,
    label: def.label,
    category: def.category,
    difficulty: def.difficulty,
    summary: def.summary,
    help: def.help,
    moveNames: def.moveNames,
    model,
    createSolved: () => solved,
    parse: (algorithm) => parseSequence(algorithm, read),
    apply: (state, move) => {
      const { axis } = named[move.name];
      const rot = stepIndex[axis][modulo(move.turns, axes[axis].order)];
      const moving = riders(state, move.name);
      return state.map((current, i) => (moving[i] ? compose[rot][current] : current));
    },
    invert: (move) => make(move.name, -move.turns),
    isSolved: def.solvedBy === 'shape' ? shapeRestored : oneColourPerFace,
    // shortcut: checks structure only (every piece a known rotation, in a slot of its own), not whether turns can
    // reach the state. Add each puzzle's parity rules if states ever come from anywhere but its own moves.
    validate: (state) => {
      if (state.length !== pieces.length || state.some((rot) => !rots[rot])) return ['A piece has an orientation the puzzle cannot give it'];
      const taken = new Set(state.map((rot, i) => slotOf(turned(rots[rot], pieces[i].centre))));
      return taken.size === pieces.length && [...taken].every((slot) => slots.has(slot)) ? [] : ['Two pieces occupy the same place'];
    },
    scramble,
    countsAsMove: (move) => !def.rotations?.includes(move.name),
    faces: (_start, moves) => moves.map(() => null),
  };
}
