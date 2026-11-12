import { createMove, type Move, type MoveTable } from './Move';

export interface ParseError {
  readonly message: string;
  /** Zero-based index of the offending character in the input. */
  readonly index: number;
}

export type ParseResult<M = Move> = { ok: true; moves: M[] } | { ok: false; error: ParseError };

const PRIMES = "'’‘`′";
const LETTERS = 'RLUDFBrludfbMESxyz';
const MAX_MOVES = 2000;
const MAX_REPEAT = 99;
const MAX_DEPTH = 16;

class SyntaxProblem extends Error {
  readonly index: number;
  constructor(message: string, index: number) {
    super(message);
    this.index = index;
  }
}

/**
 * Parses cube notation into moves for one puzzle.
 *
 *   algorithm := (move | group)*              whitespace between tokens is optional
 *   group     := "(" algorithm ")" count?
 *   move      := letter "w"? ("2" | "'" | "2'" | "'2")?
 *
 * All or nothing: a single bad token rejects the whole string, so an invalid
 * algorithm can never be partly executed.
 */
export function parseAlgorithm(input: string, table: MoveTable): ParseResult {
  let i = 0;
  let depth = 0;

  const isPrime = () => i < input.length && PRIMES.includes(input[i]);
  const isDigit = () => i < input.length && input[i] >= '0' && input[i] <= '9';

  function count(): number {
    const start = i;
    while (isDigit()) i++;
    return Number(input.slice(start, i));
  }

  function move(): Move {
    const start = i;
    const letter = String.fromCodePoint(input.codePointAt(i)!);
    if (isDigit())
      throw new SyntaxProblem(`"${letter}" has no move before it. A number goes right after a move, as in R2`, start);
    if (isPrime())
      throw new SyntaxProblem(`"${letter}" has no move before it. A prime goes right after a move, as in R'`, start);
    if (!LETTERS.includes(letter)) throw new SyntaxProblem(`"${letter}" is not a move`, start);
    i++;

    let base = letter;
    if (input[i] === 'w') {
      if (!'RLUDFB'.includes(letter))
        throw new SyntaxProblem(`"${letter}w" is not a move. Only R, L, U, D, F and B have wide turns`, start);
      base = letter.toLowerCase();
      i++;
    }
    const def = table[base];
    if (!def) throw new SyntaxProblem(`This puzzle has no ${base} move`, start);

    let prime = false;
    let double = false;
    if (isPrime()) {
      prime = true;
      i++;
    }
    if (isDigit()) {
      const amount = count();
      if (amount !== 2)
        throw new SyntaxProblem(`"${base}${amount}" is not a turn. Use ${base}, ${base}' or ${base}2`, start);
      double = true;
    }
    if (!prime && isPrime()) {
      prime = true;
      i++;
    }
    return createMove(base, def, double, prime);
  }

  function sequence(open: number | null): Move[] {
    const moves: Move[] = [];
    for (;;) {
      while (i < input.length && /\s/.test(input[i])) i++;
      if (i >= input.length) {
        if (open !== null) throw new SyntaxProblem('This "(" is never closed', open);
        return moves;
      }
      if (input[i] === ')') {
        if (open === null) throw new SyntaxProblem('This ")" has no matching "("', i);
        i++;
        return moves;
      }
      if (input[i] === '(') {
        const start = i++;
        if (++depth > MAX_DEPTH) throw new SyntaxProblem('Groups are nested too deeply', start);
        const group = sequence(start);
        depth--;
        const repeat = isDigit() ? count() : 1;
        if (repeat < 1 || repeat > MAX_REPEAT)
          throw new SyntaxProblem(`A group can repeat 1 to ${MAX_REPEAT} times`, start);
        for (let r = 0; r < repeat; r++) moves.push(...group);
      } else {
        moves.push(move());
      }
      if (moves.length > MAX_MOVES) throw new SyntaxProblem(`Algorithms are limited to ${MAX_MOVES} moves`, i - 1);
    }
  }

  try {
    return { ok: true, moves: sequence(null) };
  } catch (problem) {
    if (problem instanceof SyntaxProblem)
      return { ok: false, error: { message: problem.message, index: problem.index } };
    throw problem;
  }
}
