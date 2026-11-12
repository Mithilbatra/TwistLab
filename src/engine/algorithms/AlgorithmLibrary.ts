export const CATEGORIES = ['OLL', 'PLL', 'F2L', 'Cross', 'Beginner', 'CFOP', 'Finger tricks'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Algorithm {
  id: string;
  name: string;
  description: string;
  notation: string;
  /** 1 easy, 2 moderate, 3 demanding. */
  difficulty: 1 | 2 | 3;
  /** Every tab the algorithm is listed under. The first is its home category. */
  categories: readonly Category[];
}

const alg = (
  id: string,
  name: string,
  notation: string,
  difficulty: 1 | 2 | 3,
  categories: readonly Category[],
  description: string,
): Algorithm => ({ id, name, notation, difficulty, categories, description });

/**
 * 3×3 algorithms, written for white on the bottom and the last layer on top.
 * The CFOP tab is the two-look subset: enough to solve with CFOP before learning all 78 cases.
 * Each entry is checked by algorithms.test.ts against what its category promises.
 */
export const ALGORITHMS: readonly Algorithm[] = [
  // Cross: one edge into the front slot of the bottom cross, leaving the other three alone.
  alg('cross-drop', 'Drop in', 'F2', 1, ['Cross', 'CFOP'], 'White edge on top with white facing up, above its centre. A half turn drops it into the cross.'),
  alg('cross-flipped', 'Flipped edge', "U' R' F R", 1, ['Cross', 'CFOP'], 'White edge on top with white facing you. Steps it aside and inserts it the right way up.'),
  alg('cross-flip-in-place', 'Flip in place', "F' D R' D'", 2, ['Cross', 'CFOP'], 'A cross edge sitting in its slot upside down. Flips it without touching the other three.'),

  // F2L: fill the front-right slot.
  alg('f2l-joined-right', 'Joined pair, right', "U R U' R'", 1, ['F2L', 'CFOP'], 'Corner and edge already paired on top. Slides the pair into the front-right slot.'),
  alg('f2l-joined-front', 'Joined pair, front', "U' F' U F", 1, ['F2L', 'CFOP'], 'The mirror image: the joined pair goes in from the front.'),
  alg('f2l-split-right', 'Split pair, right', "R U R'", 1, ['F2L', 'CFOP'], 'Corner above the slot, edge across the top. Three moves pair them and insert.'),
  alg('f2l-split-front', 'Split pair, front', "F' U' F", 1, ['F2L', 'CFOP'], 'The mirror image of the split pair, inserted from the front.'),
  alg('f2l-white-up', 'White on top', "R U2 R' U' R U R'", 2, ['F2L'], 'Corner above the slot with white facing up. Opens the pair first, then inserts it.'),
  alg('f2l-edge-only', 'Edge only', "U R U' R' U' F' U F", 2, ['F2L'], 'Corner already solved, edge on top. Takes the corner out, pairs it and puts both back.'),

  // OLL: orient the last layer.
  alg('oll-edges-line', 'Edges: line', "F R U R' U' F'", 1, ['OLL', 'CFOP'], 'Two-look OLL, step one. Yellow line held left to right becomes a cross.'),
  alg('oll-edges-l', 'Edges: L shape', "f R U R' U' f'", 1, ['OLL', 'CFOP'], 'Two-look OLL, step one. Yellow L held in the back-left corner becomes a cross.'),
  alg('oll-edges-dot', 'Edges: dot', "F R U R' U' F' f R U R' U' f'", 2, ['OLL', 'CFOP'], 'Two-look OLL, step one. No yellow edges up: the line and L algorithms back to back.'),
  alg('oll-27', 'Sune', "R U R' U R U2 R'", 1, ['OLL', 'CFOP'], 'OLL 27. One corner solved, the other three twist clockwise.'),
  alg('oll-26', 'Antisune', "R U2 R' U' R U' R'", 1, ['OLL', 'CFOP'], 'OLL 26. Sune backwards: three corners twist counter-clockwise.'),
  alg('oll-21', 'Double Sune', "R U2 R' U' R U R' U' R U' R'", 2, ['OLL', 'CFOP'], 'OLL 21. No corners solved, yellow facing front and back in pairs.'),
  alg('oll-22', 'Pi', 'R U2 R2 U\' R2 U\' R2 U2 R', 2, ['OLL', 'CFOP'], 'OLL 22. No corners solved, two yellows facing the same side.'),
  alg('oll-23', 'Headlights', "R2 D R' U2 R D' R' U2 R'", 2, ['OLL', 'CFOP'], 'OLL 23. Two corners solved, the other two face the same way.'),
  alg('oll-24', 'Chameleon', "r U R' U' r' F R F'", 2, ['OLL', 'CFOP'], 'OLL 24. Two corners solved, the other two face opposite ways.'),
  alg('oll-25', 'Bowtie', "F' r U R' U' r' F R", 2, ['OLL', 'CFOP'], 'OLL 25. Two diagonal corners solved.'),
  alg('oll-33', 'T shape', "R U R' U' R' F R F'", 1, ['OLL'], 'OLL 33. Sexy move into sledgehammer, two triggers that flow together.'),
  alg('oll-37', 'Fish', "F R' F' R U R U' R'", 2, ['OLL'], 'OLL 37. Hedgeslammer followed by a reverse sexy move.'),
  alg('oll-43', 'P shape', "F' U' L' U L F", 1, ['OLL'], 'OLL 43. A left-handed trigger wrapped in F turns.'),
  alg('oll-48', 'L shape', "F R U R' U' R U R' U' F'", 2, ['OLL'], 'OLL 48. Two sexy moves wrapped in F turns.'),
  alg('oll-51', 'Line', "F U R U' R' U R U' R' F'", 2, ['OLL'], 'OLL 51. Two reverse sexy moves wrapped in F turns.'),
  alg('oll-28', 'Arrow', "r U R' U' M U R U' R'", 3, ['OLL'], 'OLL 28. All corners solved, two adjacent edges flipped.'),
  alg('oll-57', 'H edges', "R U R' U' M' U R U' r'", 3, ['OLL'], 'OLL 57. All corners solved, two opposite edges flipped.'),

  // PLL: permute the last layer.
  alg('pll-ua', 'Ua perm', "R U' R U R U R U' R' U' R2", 1, ['PLL', 'CFOP'], 'Cycles three edges. Corners stay solved.'),
  alg('pll-ub', 'Ub perm', "R2 U R U R' U' R' U' R' U R'", 1, ['PLL', 'CFOP'], 'Cycles three edges the other way.'),
  alg('pll-h', 'H perm', 'M2 U M2 U2 M2 U M2', 1, ['PLL', 'CFOP'], 'Swaps both pairs of opposite edges.'),
  alg('pll-z', 'Z perm', "M' U M2 U M2 U M' U2 M2", 2, ['PLL', 'CFOP'], 'Swaps both pairs of adjacent edges.'),
  alg('pll-aa', 'Aa perm', "x R' U R' D2 R U' R' D2 R2 x'", 2, ['PLL', 'CFOP'], 'Cycles three corners. Edges stay solved.'),
  alg('pll-ab', 'Ab perm', "x R2 D2 R U R' D2 R U' R x'", 2, ['PLL', 'CFOP'], 'Cycles three corners the other way.'),
  alg('pll-e', 'E perm', "x' R U' R' D R U R' D' R U R' D R U' R' D' x", 3, ['PLL', 'CFOP'], 'Swaps both pairs of corners across the left and right sides.'),
  alg('pll-t', 'T perm', "R U R' U' R' F R2 U' R' U' R U R' F'", 1, ['PLL'], 'Swaps two adjacent corners and two opposite edges. The first PLL most people learn.'),
  alg('pll-jb', 'Jb perm', "R U R' F' R U R' U' R' F R2 U' R'", 1, ['PLL'], 'Swaps two adjacent corners and two adjacent edges.'),
  alg('pll-ja', 'Ja perm', "x R2 F R F' R U2 r' U r U2 x'", 2, ['PLL'], 'The mirror image of the Jb perm.'),
  alg('pll-ra', 'Ra perm', "R U' R' U' R U R D R' U' R D' R' U2 R'", 2, ['PLL'], 'Swaps two adjacent corners and two adjacent edges on different sides.'),
  alg('pll-rb', 'Rb perm', "R' U2 R U2 R' F R U R' U' R' F' R2", 2, ['PLL'], 'The mirror image of the Ra perm.'),
  alg('pll-f', 'F perm', "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R", 3, ['PLL'], 'Swaps two adjacent corners and two opposite edges, leaving one solved bar.'),
  alg('pll-y', 'Y perm', "F R U' R' U' R U R' F' R U R' U' R' F R F'", 2, ['PLL'], 'Swaps two diagonal corners and two adjacent edges.'),
  alg('pll-v', 'V perm', "R' U R' U' y R' F' R2 U' R' U R' F R F", 3, ['PLL'], 'Swaps two diagonal corners and two adjacent edges. Regrips with a y rotation.'),
  alg('pll-na', 'Na perm', "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'", 3, ['PLL'], 'Swaps two diagonal corners and two opposite edges.'),
  alg('pll-nb', 'Nb perm', "R' U R U' R' F' U' F R U R' F R' F' R U' R", 3, ['PLL'], 'The mirror image of the Na perm.'),
  alg('pll-ga', 'Ga perm', "R2 U R' U R' U' R U' R2 U' D R' U R D'", 3, ['PLL'], 'Cycles three corners and three edges.'),
  alg('pll-gb', 'Gb perm', "R' U' R U D' R2 U R' U R U' R U' R2 D", 3, ['PLL'], 'The inverse of the Ga perm.'),
  alg('pll-gc', 'Gc perm', "R2 U' R U' R U R' U R2 U D' R U' R' D", 3, ['PLL'], 'Cycles three corners and three edges, mirrored.'),
  alg('pll-gd', 'Gd perm', "R U R' U' D R2 U' R U' R' U R' U R2 D'", 3, ['PLL'], 'The inverse of the Gc perm.'),

  // Beginner method: one algorithm per layer-by-layer step.
  alg('beginner-corner', 'Corner insert', "R U R' U'", 1, ['Beginner'], 'Repeat until the white corner above the front-right slot drops in: one, three or five times.'),
  alg('beginner-edge-right', 'Middle edge, right', "U R U' R' U' F' U F", 1, ['Beginner'], 'Sends the top-front edge into the front-right slot of the middle layer.'),
  alg('beginner-edge-left', 'Middle edge, left', "U' L' U L U F U' F'", 1, ['Beginner'], 'Sends the top-front edge into the front-left slot of the middle layer.'),
  alg('beginner-yellow-cross', 'Yellow cross', "F R U R' U' F'", 1, ['Beginner'], 'Turns a yellow line into a cross. From a dot or an L it takes two or three rounds.'),
  alg('beginner-yellow-edges', 'Yellow edges', "R U R' U R U2 R' U", 1, ['Beginner'], 'Swaps the front and left yellow edges once the back and right ones match their centres.'),
  alg('beginner-corner-cycle', 'Corner cycle', "U R U' L' U R' U' L", 2, ['Beginner'], 'Keeps the front-right corner where it is and cycles the other three yellow corners.'),
  alg('beginner-corner-twist', 'Corner twist', "(R' D' R D)2 U (R' D' R D)4 U'", 2, ['Beginner'], "Twists the last corners. Repeat R' D' R D on one corner, turn U, repeat on the next."),

  // Finger tricks: short triggers that longer algorithms are built from.
  alg('trigger-sexy', 'Sexy move', "R U R' U'", 1, ['Finger tricks'], 'The most common trigger in cubing. Wrist turns R, right index flicks U, left index pushes it back.'),
  alg('trigger-reverse-sexy', 'Reverse sexy', "U R U' R'", 1, ['Finger tricks'], 'The same four moves from the other end. Start with the index flick.'),
  alg('trigger-sledgehammer', 'Sledgehammer', "R' F R F'", 1, ['Finger tricks'], 'Right index pulls F from the bottom corner, right thumb pushes it back.'),
  alg('trigger-hedgeslammer', 'Hedgeslammer', "F R' F' R", 1, ['Finger tricks'], 'The sledgehammer backwards. Often follows it directly.'),
  alg('trigger-left-sexy', 'Left sexy', "L' U' L U", 1, ['Finger tricks'], 'The mirror image for the left hand. Worth drilling until it is as fast as the right.'),
  alg('trigger-double-flick', 'Double flick', "R U2 R'", 1, ['Finger tricks'], 'U2 as one motion: right index, then right middle finger, without regripping.'),
  alg('trigger-fat-sexy', 'Fat sexy', "r U R' U'", 2, ['Finger tricks'], 'A sexy move that opens with a wide turn. It sets up many OLL cases.'),
];
