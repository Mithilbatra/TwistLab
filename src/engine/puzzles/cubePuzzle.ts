import { applyMove, createSolvedCube, isSolved, turnedFaces, type CubeState } from '../core/CubeState';
import { validateCube } from '../core/CubeValidator';
import { createMoveTable, invertMove, type Move, type MoveTable } from '../core/Move';
import { parseAlgorithm } from '../core/MoveParser';
import { generateScramble } from '../core/scramble';
import type { Puzzle, PuzzleInfo } from './PuzzleEngine';

/** An n×n×n cube. `size` and `table` are what the cubic 3D model needs beyond the common interface. */
export interface CubePuzzle extends Puzzle<CubeState, Move> {
  readonly size: number;
  readonly table: MoveTable;
}

export function createCubePuzzle(size: number, info: Omit<PuzzleInfo, 'category'>): CubePuzzle {
  const table = createMoveTable(size);
  const solved = createSolvedCube(size);
  const notation = [
    'Faces R L U D F B',
    size % 2 === 1 && 'slices M E S',
    size >= 3 && 'wide r or Rw',
    size >= 4 && 'deeper 3Rw, inner layers 2R',
    'rotations x y z',
  ];
  return {
    ...info,
    id: `${size}x${size}`,
    label: `${size}×${size}`,
    category: 'Classic Cubes',
    help: `${notation.filter(Boolean).join(', ')}. Add ' to reverse, 2 to double, and (R U)3 to repeat.`,
    model: { kind: 'cube' },
    size,
    table,
    createSolved: () => solved,
    parse: (algorithm) => parseAlgorithm(algorithm, table),
    apply: applyMove,
    invert: invertMove,
    isSolved: (state) => isSolved(state, size),
    validate: (state) => validateCube(state, size),
    scramble: (random) => generateScramble(size, table, random),
    countsAsMove: (move) => move.layers.length < size,
    faces: (start, moves) => turnedFaces(start, moves, size),
  };
}
