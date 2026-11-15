import { createMove, type Move, type MoveTable } from './Move';

export interface ParseError {
  readonly message: string;
  /** Zero-based index of the offending character in the input. */
  readonly index: number;
}

export type ParseResult<M = Move> = { ok: true; moves: M[] } | { ok: false; error: ParseError };

export const PRIMES = "'’‘`′";
const LETTERS = 'RLUDFBrludfbMESxyz';
const MAX_MOVES = 2000;
const MAX_REPEAT = 99;
const MAX_DEPTH = 16;

export class SyntaxProblem extends Error {
  readonly index: number;
  constructor(message: string, index: number) {
    super(message);
    this.index = index;
  }
}

/** Reads the one move that starts at `index` and says where it ends. Throws a SyntaxProblem if there is none. */
export type MoveReader<M> = (input: string, index: number) => { move: M; end: number };

/**
 * Parses an algorithm for any puzzle. The puzzle supplies the reader for a single
 * move; grouping and repeats are the same everywhere.
 *
 *   algorithm := (move | group)*              whitespace between tokens is optional
 *   group     := "(" algorithm ")" count?
 *
 * All or nothing: a single bad token rejects the whole string, so an invalid
 * algorithm can never be partly executed.
 */
export function parseSequence<M>(input: string, readMove: MoveReader<M>): ParseResult<M> {
  let i = 0;
  let depth = 0;

  function sequence(open: number | null): M[] {
    const moves: M[] = [];
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
        const digits = /^\d*/.exec(input.slice(i))![0];
        i += digits.length;
        const repeat = digits === '' ? 1 : Number(digits);
        if (repeat < 1 || repeat > MAX_REPEAT)
          throw new SyntaxProblem(`A group can repeat 1 to ${MAX_REPEAT} times`, start);
        for (let r = 0; r < repeat; r++) moves.push(...group);
      } else {
        const { move, end } = readMove(input, i);
        moves.push(move);
        i = end;
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

/**
 * Parses cube notation into moves for one cube.
 *
 *   move := depth? letter "w"? ("2" | "'" | "2'" | "'2")?
 *
 * `depth` exists only on cubes with inner layers: 2R is the second layer on its
 * own, 3Rw the outer three together.
 */
export function parseAlgorithm(input: string, table: MoveTable): ParseResult {
  return parseSequence(input, (text, start) => {
    let i = start;
    const isPrime = () => i < text.length && PRIMES.includes(text[i]);
    const isDigit = () => i < text.length && text[i] >= '0' && text[i] <= '9';
    const digits = () => {
      const from = i;
      while (isDigit()) i++;
      return text.slice(from, i);
    };

    const depth = table['2R'] ? digits() : '';
    const letter = i < text.length ? String.fromCodePoint(text.codePointAt(i)!) : '';
    if (depth !== '' && !'RLUDFBrludfb'.includes(letter || ' '))
      throw new SyntaxProblem(`"${depth}" has no face after it. A depth goes before a face, as in 2R or 3Rw`, start);
    if (isDigit())
      throw new SyntaxProblem(`"${letter}" has no move before it. A number goes right after a move, as in R2`, start);
    if (isPrime())
      throw new SyntaxProblem(`"${letter}" has no move before it. A prime goes right after a move, as in R'`, start);
    if (!LETTERS.includes(letter)) throw new SyntaxProblem(`"${letter}" is not a move`, start);
    i++;

    let base = letter;
    if (text[i] === 'w') {
      if (!'RLUDFB'.includes(letter))
        throw new SyntaxProblem(`"${letter}w" is not a move. Only R, L, U, D, F and B have wide turns`, start);
      base = letter.toLowerCase();
      i++;
    }
    // A wide turn two layers deep is plain r; any other depth is written in front.
    if (depth !== '' && !(depth === '2' && base === base.toLowerCase())) base = depth + base;
    const def = table[base];
    if (!def) throw new SyntaxProblem(`This puzzle has no ${base} move`, start);

    let prime = false;
    let double = false;
    if (isPrime()) {
      prime = true;
      i++;
    }
    if (isDigit()) {
      const amount = Number(digits());
      if (amount !== 2)
        throw new SyntaxProblem(`"${base}${amount}" is not a turn. Use ${base}, ${base}' or ${base}2`, start);
      double = true;
    }
    if (!prime && isPrime()) {
      prime = true;
      i++;
    }
    return { move: createMove(base, def, double, prime), end: i };
  });
}
