import { applyMoves, centreFrame, turnedFaces, type CubeState } from '../core/CubeState';
import { sameValues, transform, type Vec3 } from '../core/math';
import { invertMoves, type Move } from '../core/Move';
import { PUZZLES } from '../puzzles';

const cube = PUZZLES['3x3'];

export function parse3x3(algorithm: string): Move[] {
  const parsed = cube.parse(algorithm);
  if (!parsed.ok) throw new Error(`${algorithm}: ${parsed.error.message}`);
  return parsed.moves;
}

/** Lessons and library demos hold the cube white-down, yellow-up. */
export const HOLD = parse3x3('z2');

/** The position an algorithm solves: the held cube with the algorithm undone. */
export const demoSetup = (algorithm: readonly Move[]): Move[] => [...HOLD, ...invertMoves(algorithm)];

/** An algorithm as the library draws it: its moves, and the colour of the face each one turns when its demo plays. */
export function demoStrip(algorithm: string): { moves: Move[]; faces: (number | null)[] } {
  const moves = parse3x3(algorithm);
  return { moves, faces: turnedFaces(applyMoves(cube.createSolved(), demoSetup(moves)), moves, 3) };
}

/**
 * Which layer-by-layer stage solves a piece, from where it lives in the solved cube.
 * White is the +y layer at home. 0 centres, 1 white edges, 2 white corners,
 * 3 middle edges, 4 yellow edges, 5 yellow corners.
 */
export function stageOf(home: Vec3): number {
  const outer = home.filter((v) => v !== 0).length; // 1 centre, 2 edge, 3 corner
  if (outer === 1) return 0;
  if (home[1] > 0) return outer === 2 ? 1 : 2;
  if (home[1] === 0) return 3;
  return outer === 2 ? 4 : 5;
}

/** solved: home and oriented. oriented: yellow sticker facing the yellow centre. placed: in its own slot, any twist. */
type Check = 'solved' | 'oriented' | 'placed';

function stageIs(state: CubeState, stage: number, check: Check): boolean {
  const frame = centreFrame(state, 3);
  return state
    .filter((cubie) => stageOf(cubie.home) === stage)
    .every((cubie) => {
      if (check === 'solved') return sameValues(cubie.rot, frame);
      if (check === 'placed') return sameValues(cubie.pos, transform(frame, cubie.home));
      return [1, 4, 7].every((i) => cubie.rot[i] === frame[i]); // middle column: where the up/down sticker points
    });
}

export interface Lesson {
  id: string;
  title: string;
  goal: string;
  steps: readonly string[];
  cases: readonly { name: string; when: string; algorithm: string }[];
  /** The stage this lesson works on, and what it must achieve there. */
  stage: number;
  check: Check;
}

/** A lesson is done when every earlier stage is solved and its own stage passes its check. */
export function lessonDone(lesson: Lesson, state: CubeState): boolean {
  for (let stage = 1; stage < lesson.stage; stage++) if (!stageIs(state, stage, 'solved')) return false;
  return stageIs(state, lesson.stage, lesson.check);
}

/** Ids of the cubies a lesson has not reached yet. They are greyed out so the eye stays on the current stage. */
export const laterPieces = (lesson: Lesson): Set<number> =>
  new Set(cube.createSolved().filter((cubie) => stageOf(cubie.home) > lesson.stage).map((cubie) => cubie.id));

/**
 * A random practice position: everything before this lesson solved, this lesson's stage not.
 * Built by undoing the lesson's own algorithms from different sides, which by construction
 * never disturbs an earlier stage.
 */
export function practiceSetup(lesson: Lesson, random: () => number = Math.random): Move[] {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
  for (;;) {
    const setup = [...HOLD];
    if (lesson.stage === 1) setup.push(...cube.scramble(random).slice(0, 7));
    else
      for (let round = 0; round < 3; round++)
        setup.push(
          ...parse3x3(pick(['', 'y', 'y2', "y'"])),
          ...invertMoves(parse3x3(pick(lesson.cases).algorithm)),
          // Turning the top layer adds variety, but once the yellow edges are solved it would undo them.
          ...parse3x3(lesson.stage < 5 ? pick(['', 'U', 'U2', "U'"]) : ''),
        );
    if (!lessonDone(lesson, applyMoves(cube.createSolved(), setup))) return setup;
  }
}

/** The beginner's layer-by-layer method, white first. Claims in the text are checked by algorithms.test.ts. */
export const LESSONS: readonly Lesson[] = [
  {
    id: 'white-cross',
    title: 'White cross',
    goal: 'Place the four white edges around the white centre, each one matching the centre on its side.',
    steps: [
      'Hold the cube with white on the bottom. Centres never move, so they tell you where every piece belongs.',
      'Find a white edge in the top layer. Turn U until its side colour sits above the matching centre, then drop it in.',
      'Solve one edge at a time, and check that each side colour lines up with its centre before moving on.',
    ],
    cases: [
      { name: 'White facing up', when: 'The edge is above its centre with white on top.', algorithm: 'F2' },
      { name: 'White facing you', when: 'The edge is above its centre with white on the front.', algorithm: "U' R' F R" },
      { name: 'Edge in the middle layer', when: 'The edge is in the front-right slot with white facing right.', algorithm: 'F' },
      { name: 'Flipped in place', when: 'The edge is in its slot, upside down.', algorithm: "F' D R' D'" },
    ],
    stage: 1,
    check: 'solved',
  },
  {
    id: 'white-corners',
    title: 'White corners',
    goal: 'Finish the white layer by inserting its four corners.',
    steps: [
      'Find a white corner in the top layer. Turn U until it sits directly above its slot, between the two centres that match its side colours.',
      "Hold that slot at the front right and repeat R U R' U' until the corner drops in with white facing down.",
      "A corner stuck in the bottom layer the wrong way round comes out with a single R U R' U'. Then treat it like any other.",
    ],
    cases: [
      { name: 'White facing right', when: 'One round.', algorithm: "R U R' U'" },
      { name: 'White facing up', when: 'Three rounds.', algorithm: "(R U R' U')3" },
      { name: 'White facing you', when: 'Five rounds.', algorithm: "(R U R' U')5" },
    ],
    stage: 2,
    check: 'solved',
  },
  {
    id: 'middle-layer',
    title: 'Middle layer',
    goal: 'Insert the four edges that have no yellow on them into the middle layer.',
    steps: [
      'Find a top-layer edge with no yellow. Turn U until its front colour matches the centre below it, making an upside-down T.',
      'Its top colour tells you which side it belongs on. Use the matching algorithm to send it right or left.',
      'An edge already in the middle layer but wrong? Insert any other edge into its slot to pop it out.',
    ],
    cases: [
      { name: 'Edge goes right', when: 'The top colour matches the right centre.', algorithm: "U R U' R' U' F' U F" },
      { name: 'Edge goes left', when: 'The top colour matches the left centre.', algorithm: "U' L' U L U F U' F'" },
    ],
    stage: 3,
    check: 'solved',
  },
  {
    id: 'yellow-cross',
    title: 'Yellow cross',
    goal: 'Turn the four yellow edges face up. Where they sit does not matter yet.',
    steps: [
      'Look only at the yellow edges on top. You will see a dot, an L, a line or a finished cross.',
      "Line: hold it left to right and do F R U R' U' F'.",
      "L: hold it in the back-left corner and do F U R U' R' F'. From a dot, do one and then the other.",
    ],
    cases: [
      { name: 'Line to cross', when: 'Yellow line held left to right.', algorithm: "F R U R' U' F'" },
      { name: 'L to cross', when: 'Yellow L held in the back-left corner.', algorithm: "F U R U' R' F'" },
    ],
    stage: 4,
    check: 'oriented',
  },
  {
    id: 'yellow-edges',
    title: 'Yellow edges',
    goal: 'Move the yellow edges until each side colour matches its centre.',
    steps: [
      'Turn U and count how many edges match their centres. You can always line up at least two.',
      "Two neighbours match: hold them at the back and right, then do R U R' U R U2 R' U.",
      'Two opposite edges match: do the algorithm once from any side. That leaves the neighbour case.',
    ],
    cases: [
      { name: 'Swap front and left', when: 'The back and right edges already match.', algorithm: "R U R' U R U2 R' U" },
    ],
    stage: 4,
    check: 'solved',
  },
  {
    id: 'yellow-corners',
    title: 'Place yellow corners',
    goal: 'Put each yellow corner in its own slot. It may still be twisted.',
    steps: [
      'A corner is in the right slot when its three colours match the three centres around it, whichever way it is turned.',
      "Find a corner that is already right and hold it at the front right. Then do U R U' L' U R' U' L to cycle the other three.",
      'No corner right yet? Do the algorithm once from any side and look again.',
    ],
    cases: [
      { name: 'Cycle three corners', when: 'The front-right corner is already in its slot.', algorithm: "U R U' L' U R' U' L" },
    ],
    stage: 5,
    check: 'placed',
  },
  {
    id: 'twist-corners',
    title: 'Twist yellow corners',
    goal: 'Twist the last corners so yellow faces up. That solves the cube.',
    steps: [
      "Hold an unsolved corner at the front right. Repeat R' D' R D until its yellow faces up: two or four rounds.",
      'The lower layers will look scrambled. Do not rotate the cube. Turn only U to bring the next unsolved corner to the front right.',
      "Repeat R' D' R D on that corner. When the last one is done the lower layers fall back into place. Finish by turning U.",
    ],
    cases: [
      {
        name: 'Two twisted corners',
        when: 'The front-right and back-right corners need twisting.',
        algorithm: "(R' D' R D)2 U (R' D' R D)4 U'",
      },
    ],
    stage: 5,
    check: 'solved',
  },
];
