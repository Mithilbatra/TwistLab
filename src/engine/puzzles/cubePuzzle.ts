import { applyMove, createSolvedCube, isSolved, type CubeState } from '../core/CubeState';
import { validateCube } from '../core/CubeValidator';
import { createMoveTable, invertMove, type Move, type MoveTable } from '../core/Move';
import { parseAlgorithm } from '../core/MoveParser';
import { generateScramble } from '../core/scramble';
import type { PuzzleEngine } from './PuzzleEngine';

/** An n×n×n cube. `size` and `table` are what the cubic 3D model needs beyond the generic engine. */
export interface CubePuzzle extends PuzzleEngine<CubeState, Move> {
  readonly size: number;
  readonly table: MoveTable;
}

export function createCubePuzzle(size: number, id: string, name: string, summary: string): CubePuzzle {
  const table = createMoveTable(size);
  const solved = createSolvedCube(size);
  return {
    id,
    name,
    summary,
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
  };
}
