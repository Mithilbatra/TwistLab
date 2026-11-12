import { createCubePuzzle } from './cubePuzzle';

/** Puzzles with a complete engine and 3D model. Add an entry here to make a puzzle selectable. */
export const PUZZLES = {
  '2x2': createCubePuzzle(2, '2x2', '2×2 Pocket Cube', 'Eight corners and nothing else. 3.6 million positions.'),
  '3x3': createCubePuzzle(3, '3x3', "3×3 Rubik's Cube", 'The original. 26 cubies, 43 quintillion positions.'),
} as const;

export type PuzzleId = keyof typeof PUZZLES;

/** Planned puzzles. The library lists them as unavailable until an engine and model exist. */
export const UPCOMING = [
  { name: '4×4 Revenge', summary: 'No fixed centres, plus parity cases.' },
  { name: 'Pyraminx', summary: 'Four axes and three-way turns.' },
  { name: 'Megaminx', summary: 'Twelve faces, fifty moving pieces.' },
  { name: 'Skewb', summary: 'A cube that turns around its corners.' },
] as const;
