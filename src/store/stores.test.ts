// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMoves, type CubeState } from '../engine/core/CubeState';
import { PUZZLES } from '../engine/puzzles';
import { averageOf, formatTime, histogram } from '../utils/stats';
import { useAlgorithm } from './algorithmStore';
import { animation, useCube } from './cubeStore';
import { DEFAULT_KEYMAP, useSettings } from './settingsStore';
import { useTimer } from './timerStore';

const cube = PUZZLES['3x3'];
const solved = cube.createSolved();

function moves(algorithm: string) {
  const parsed = cube.parse(algorithm);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.moves;
}
const after = (algorithm: string) => applyMoves(solved, moves(algorithm));

/** Runs every queued animation to completion, then lets anything awaiting the queue continue. */
async function finishAnimations() {
  while (animation.busy) animation.tick(0.45);
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  animation.instant = false;
  useCube.getState().setPuzzle('3x3');
  useCube.getState().load();
  useAlgorithm.getState().close();
  useTimer.getState().cancel();
  useTimer.setState({ solves: [] });
  useSettings.setState({ inspection: 0, speed: 1, keymap: { ...DEFAULT_KEYMAP } });
});

describe('cube store and its animation', () => {
  it('updates the logical state at once, and the model comes to rest on that same state', () => {
    useCube.getState().turn(moves("R U R' U' F2"));
    const logical = useCube.getState().state;
    expect(logical).toEqual(after("R U R' U' F2"));
    expect(animation.displayed).toBe(solved); // nothing has finished animating yet
    expect(animation.backlog).toBe(4);

    while (animation.busy) animation.tick(0.45);

    expect(useCube.getState().state).toBe(logical); // completing animations changed nothing
    expect(animation.displayed).toBe(logical);
    expect(cube.validate(animation.displayed)).toEqual([]);
  });

  it('keeps state and model consistent when moves, undo and redo arrive mid-animation', () => {
    const { turn, undo, redo } = useCube.getState();
    turn(moves('R'));
    animation.tick(0.5);
    turn(moves('U F'));
    undo();
    animation.tick(0.7);
    undo();
    redo();
    turn(moves("D'"));
    expect(useCube.getState().state).toEqual(after("R U D'"));
    expect(useCube.getState().history.map((move) => move.notation)).toEqual(['R', 'U', "D'"]);

    while (animation.busy) animation.tick(0.45);
    expect(animation.displayed).toBe(useCube.getState().state);
  });

  it('undo and redo restore the exact earlier state, step by step', () => {
    const sequence = moves("R U2 F' M x r' D B2 E S' y' L u z2 f");
    const states: CubeState[] = [solved];
    for (const move of sequence) {
      useCube.getState().turn([move]);
      states.push(useCube.getState().state);
    }
    for (let i = sequence.length - 1; i >= 0; i--) {
      useCube.getState().undo();
      expect(useCube.getState().state, `undo to ${i}`).toEqual(states[i]);
    }
    expect(useCube.getState().history).toEqual([]);
    useCube.getState().undo(); // nothing left: a no-op
    expect(useCube.getState().state).toEqual(solved);
    for (let i = 1; i <= sequence.length; i++) {
      useCube.getState().redo();
      expect(useCube.getState().state, `redo to ${i}`).toEqual(states[i]);
    }
    expect(useCube.getState().future).toEqual([]);
  });

  it('drops the redo stack on a new move, and clearing history leaves the cube alone', () => {
    const { turn, undo, clearHistory } = useCube.getState();
    turn(moves('R U'));
    undo();
    expect(useCube.getState().future).toHaveLength(1);
    turn(moves('F'));
    expect(useCube.getState().future).toEqual([]);
    clearHistory();
    expect(useCube.getState().history).toEqual([]);
    expect(useCube.getState().state).toEqual(after('R F'));
  });

  it('scrambles into a valid unsolved state and resets to solved', () => {
    useCube.getState().turn(moves('R U'));
    useCube.getState().scrambleCube();
    const { state, scramble, history } = useCube.getState();
    expect(scramble).toHaveLength(20);
    expect(history).toEqual([]);
    expect(state).toEqual(applyMoves(solved, scramble));
    expect(cube.validate(state)).toEqual([]);
    expect(cube.isSolved(state)).toBe(false);

    const epoch = useCube.getState().epoch;
    useCube.getState().load();
    expect(useCube.getState().state).toBe(solved);
    expect(useCube.getState().scramble).toEqual([]);
    expect(useCube.getState().epoch).toBe(epoch + 1);
    expect(animation.busy).toBe(false);
    expect(animation.displayed).toBe(solved);
  });

  it('switches puzzle in one step, never pairing a puzzle with the wrong cubies', () => {
    const seen: number[] = [];
    const unsubscribe = useCube.subscribe((s) => {
      expect(s.state).toHaveLength(PUZZLES[s.puzzleId].createSolved().length);
      seen.push(s.state.length);
    });
    useCube.getState().turn(moves('R'));
    useCube.getState().setPuzzle('2x2');
    unsubscribe();
    expect(seen).toEqual([26, 8]);
    expect(useCube.getState().history).toEqual([]);
    expect(animation.displayed).toBe(PUZZLES['2x2'].createSolved());
  });
});

describe('algorithm playback', () => {
  it('issues one move per finished animation and stops where it is paused', async () => {
    useAlgorithm.getState().open(moves("R U R' U'"));
    const finished = useAlgorithm.getState().play();
    expect(useAlgorithm.getState()).toMatchObject({ index: 1, playing: true }); // only the first move so far
    expect(animation.backlog).toBe(0);

    await finishAnimations();
    expect(useAlgorithm.getState().index).toBe(2);

    useAlgorithm.getState().pause();
    await finishAnimations();
    await finished;
    expect(useAlgorithm.getState()).toMatchObject({ index: 2, playing: false });
    expect(useCube.getState().state).toEqual(after('R U'));
  });

  it('resumes, steps both ways and rewinds', async () => {
    animation.instant = true;
    const playback = useAlgorithm.getState();
    playback.open(moves("R U R' U'"));
    playback.next();
    playback.next();
    expect(useCube.getState().state).toEqual(after('R U'));
    playback.previous();
    expect(useAlgorithm.getState().index).toBe(1);
    expect(useCube.getState().state).toEqual(after('R'));

    await playback.play();
    expect(useAlgorithm.getState()).toMatchObject({ index: 4, playing: false });
    expect(useCube.getState().state).toEqual(after("R U R' U'"));
    playback.next(); // past the end: a no-op
    expect(useAlgorithm.getState().index).toBe(4);

    playback.restart();
    expect(useAlgorithm.getState().index).toBe(0);
    expect(useCube.getState().state).toEqual(solved);
  });

  it('a second play while one is running does not double-step', async () => {
    useAlgorithm.getState().open(moves('R U F'));
    void useAlgorithm.getState().play();
    void useAlgorithm.getState().play();
    expect(useAlgorithm.getState().index).toBe(1);
    await finishAnimations();
    expect(useAlgorithm.getState().index).toBe(2);
    await finishAnimations();
    await finishAnimations();
    expect(useAlgorithm.getState()).toMatchObject({ index: 3, playing: false });
    expect(useCube.getState().state).toEqual(after('R U F'));
  });

  it('sets a demo up from its starting position and returns to it on restart', async () => {
    animation.instant = true;
    const algorithm = moves("R U R' U R U2 R'");
    const setup = [...moves('z2'), ...algorithm.map(cube.invert).reverse()];
    useCube.getState().turn(moves('F B'));
    useAlgorithm.getState().open(algorithm, { title: 'Sune', setup });
    const start = useCube.getState().state;
    expect(start).toEqual(applyMoves(solved, setup));
    expect(useCube.getState().history).toEqual([]);

    await useAlgorithm.getState().play();
    expect(cube.isSolved(useCube.getState().state)).toBe(true);
    useAlgorithm.getState().restart();
    expect(useCube.getState().state).toEqual(start);
    expect(useAlgorithm.getState()).toMatchObject({ index: 0, title: 'Sune' });
  });

  it('rewinds when the cube is reset and closes when the puzzle changes', async () => {
    useAlgorithm.getState().open(moves('R U F'));
    void useAlgorithm.getState().play();
    await finishAnimations();
    useCube.getState().load();
    await finishAnimations();
    expect(useAlgorithm.getState()).toMatchObject({ index: 0, playing: false });
    expect(useCube.getState().state).toBe(solved);

    useCube.getState().setPuzzle('2x2');
    expect(useAlgorithm.getState().moves).toEqual([]);
  });
});

describe('timer', () => {
  afterEach(() => vi.useRealTimers());

  it('starts on release, stops on the next press and records the solve', () => {
    const timer = useTimer.getState();
    timer.newScramble();
    const scramble = useTimer.getState().scramble;
    expect(useCube.getState().state).toEqual(after(scramble)); // the cube shows the scramble in the text

    timer.press(1000);
    expect(useTimer.getState()).toMatchObject({ phase: 'idle', armed: true });
    timer.release(1500);
    expect(useTimer.getState()).toMatchObject({ phase: 'running', armed: false });
    timer.press(13_840);
    expect(useTimer.getState().phase).toBe('idle');
    expect(useTimer.getState().solves).toEqual([expect.objectContaining({ ms: 12_340, scramble, puzzle: '3x3' })]);
    expect(useTimer.getState().scramble).not.toBe(scramble);

    timer.release(13_900); // the release of the stopping press must not start another solve
    expect(useTimer.getState()).toMatchObject({ phase: 'idle', armed: false });
  });

  it('runs inspection first, and starts the solve when inspection runs out', () => {
    vi.useFakeTimers();
    useSettings.setState({ inspection: 15 });
    const timer = useTimer.getState();
    timer.press(0);
    timer.release(10);
    expect(useTimer.getState().phase).toBe('inspecting');
    timer.press(4000);
    timer.release(4100);
    expect(useTimer.getState()).toMatchObject({ phase: 'running', since: 4100 });
    vi.advanceTimersByTime(20_000); // the abandoned inspection timeout must not restart the clock
    expect(useTimer.getState().since).toBe(4100);
    timer.cancel();

    timer.press(0);
    timer.release(10);
    vi.advanceTimersByTime(15_000);
    expect(useTimer.getState().phase).toBe('running');
  });

  it('cancels without recording, and deletes single solves', () => {
    const timer = useTimer.getState();
    timer.press(0);
    timer.release(10);
    timer.cancel();
    expect(useTimer.getState()).toMatchObject({ phase: 'idle', armed: false, solves: [] });

    for (const end of [1000, 2000]) {
      timer.press(0);
      timer.release(0);
      timer.press(end);
      timer.release(end);
    }
    const [first, second] = useTimer.getState().solves;
    timer.removeSolve(first.id);
    expect(useTimer.getState().solves).toEqual([second]);
  });

  it('ignores a release that no press armed', () => {
    useTimer.getState().release(100);
    expect(useTimer.getState().phase).toBe('idle');
  });
});

describe('saved data', () => {
  it('survives corrupt settings by falling back or clamping', async () => {
    localStorage.setItem(
      'twistlab.settings',
      JSON.stringify({ state: { speed: 'fast', inspection: 999, fov: null, keymap: { R: 5, L: 'k' } }, version: 0 }),
    );
    await useSettings.persist.rehydrate();
    const { speed, inspection, fov, keymap } = useSettings.getState();
    expect({ speed, inspection, fov }).toEqual({ speed: 1, inspection: 60, fov: 35 });
    expect(keymap).toEqual({ ...DEFAULT_KEYMAP, L: 'k' });
  });

  it('drops malformed solves and keeps the good ones', async () => {
    const good = { id: 'a', ms: 9870, scramble: 'R U', puzzle: '3x3', at: 1 };
    localStorage.setItem(
      'twistlab.timer',
      JSON.stringify({ state: { solves: [good, { ...good, ms: 'quick' }, { ...good, puzzle: '7x7' }, null, 42] }, version: 0 }),
    );
    await useTimer.persist.rehydrate();
    expect(useTimer.getState().solves).toEqual([good]);

    localStorage.setItem('twistlab.timer', '{"state":{"solves":"none"},"version":0}');
    await useTimer.persist.rehydrate();
    expect(useTimer.getState().solves).toEqual([]);
  });

  it('gives a key to one move family at a time', () => {
    useSettings.getState().bindKey('R', 'j');
    useSettings.getState().bindKey('U', 'j');
    expect(useSettings.getState().keymap).toMatchObject({ R: '', U: 'j', L: 'l' });
    useSettings.getState().resetKeymap();
    expect(useSettings.getState().keymap).toEqual(DEFAULT_KEYMAP);
  });
});

describe('statistics', () => {
  it('formats times with truncated hundredths', () => {
    expect(formatTime(0)).toBe('0.00');
    expect(formatTime(9870)).toBe('9.87');
    expect(formatTime(9999)).toBe('9.99');
    expect(formatTime(62_450)).toBe('1:02.45');
    expect(formatTime(600_000)).toBe('10:00.00');
  });

  it('averages the last n solves without the best and the worst', () => {
    const times = [99_000, 10_000, 20_000, 30_000, 40_000, 50_000];
    expect(averageOf(times, 5)).toBe(30_000);
    expect(averageOf(times.slice(0, 4), 5)).toBeNull();
    expect(averageOf(times, 12)).toBeNull();
    expect(averageOf([12_000, 11_000, 13_000, 60_000, 1000], 5)).toBe(12_000);
  });

  it('bins every time exactly once, in whole-second bins', () => {
    const times = [8200, 9100, 9900, 12_000, 12_999, 31_450];
    const bins = histogram(times);
    expect(bins.reduce((sum, bin) => sum + bin.count, 0)).toBe(times.length);
    expect(bins.length).toBeLessThanOrEqual(11);
    for (const [i, bin] of bins.entries()) {
      expect((bin.to - bin.from) % 1000).toBe(0);
      if (i > 0) expect(bin.from).toBe(bins[i - 1].to);
    }
    expect(bins[0].from).toBeLessThanOrEqual(8200);
    expect(bins[bins.length - 1].to).toBeGreaterThan(31_450);
    expect(histogram([])).toEqual([]);
    expect(histogram([5000, 5000])).toEqual([{ from: 5000, to: 6000, count: 2 }]);
  });
});
