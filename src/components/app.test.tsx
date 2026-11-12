// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMoves } from '../engine/core/CubeState';
import { HOLD, parse3x3 } from '../engine/algorithms/lessons';
import { PUZZLES } from '../engine/puzzles';
import { useKeyboard } from '../hooks/useKeyboard';
import { LabPanel } from '../pages/LabPanel';
import { LearnPanel } from '../pages/LearnPanel';
import { PlaygroundPanel } from '../pages/PlaygroundPanel';
import { SettingsPanel } from '../pages/SettingsPanel';
import { TimerPanel } from '../pages/TimerPanel';
import { useAlgorithm } from '../store/algorithmStore';
import { animation, useCube } from '../store/cubeStore';
import { DEFAULT_KEYMAP, useSettings } from '../store/settingsStore';
import { useTimer } from '../store/timerStore';
import { BottomBar } from './layout/BottomBar';

// Practice positions are random. Pin them to each lesson's first case so the test knows the solution.
vi.mock('../engine/algorithms/lessons', async (original) => {
  const actual = await original<typeof import('../engine/algorithms/lessons')>();
  return {
    ...actual,
    practiceSetup: (lesson: (typeof actual.LESSONS)[number]) =>
      actual.demoSetup(actual.parse3x3(lesson.cases[0].algorithm)),
  };
});

const cube = PUZZLES['3x3'];

/** Mounts the global shortcuts around whatever is being tested, as App does. */
function Harness({ children }: { children?: ReactNode }) {
  useKeyboard();
  return <>{children}</>;
}

const history = () => useCube.getState().history.map((move) => move.notation).join(' ');
const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  fireEvent.keyDown(target, { key, ...init });
const algorithmField = () => screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Algorithm' });

beforeEach(() => {
  animation.instant = true; // no render loop in tests: turns complete as they are issued
  useCube.getState().setPuzzle('3x3');
  useCube.getState().load();
  useAlgorithm.getState().close();
  useAlgorithm.setState({ input: "R U R' U'", favourites: [], completedLessons: [] });
  useTimer.getState().cancel();
  useTimer.setState({ solves: [] });
  useSettings.setState({ view: 'playground', inspection: 0, keymap: { ...DEFAULT_KEYMAP } });
});

afterEach(cleanup);

describe('keyboard control', () => {
  it('turns faces, reverses with Shift, widens with Alt and ignores unbound keys', () => {
    render(
      <Harness>
        <BottomBar />
      </Harness>,
    );
    expect(screen.getByTestId('cube-status').textContent).toBe('Solved');
    press('r');
    press('U', { shiftKey: true });
    press('®', { altKey: true, code: 'KeyR' }); // what macOS reports for Alt+R
    press('x');
    press('q');
    expect(history()).toBe("R U' r x");
    expect(screen.getByTestId('move-count').textContent).toBe('3'); // the rotation is not a move
    expect(screen.getByTestId('cube-status').textContent).toBe('Unsolved');
  });

  it('does not repeat a turn while a key is held', () => {
    render(<Harness />);
    press('r');
    press('r', { repeat: true });
    expect(history()).toBe('R');
  });

  it('ignores moves the current puzzle does not have', () => {
    render(<Harness />);
    act(() => useCube.getState().setPuzzle('2x2'));
    press('m');
    press('®', { altKey: true, code: 'KeyR' });
    press('f');
    expect(history()).toBe('F');
  });

  it('stands down completely while text is being typed', () => {
    render(
      <Harness>
        <PlaygroundPanel />
      </Harness>,
    );
    const field = algorithmField();
    press('r', {}, field);
    press(' ', {}, field);
    press('ArrowRight', {}, field);
    press('z', { ctrlKey: true }, field);
    expect(history()).toBe('');
    expect(useAlgorithm.getState().playing).toBe(false);
    press('r');
    expect(history()).toBe('R');
  });

  it('undoes and redoes with Ctrl or Cmd', () => {
    render(<Harness />);
    press('r');
    press('u');
    press('z', { ctrlKey: true });
    expect(history()).toBe('R');
    press('Z', { metaKey: true, shiftKey: true });
    expect(history()).toBe('R U');
    press('z', { metaKey: true });
    press('y', { ctrlKey: true });
    expect(history()).toBe('R U');
  });

  it('plays with Space from the page, but leaves Space to a focused button', async () => {
    render(
      <Harness>
        <PlaygroundPanel />
      </Harness>,
    );
    act(() => useAlgorithm.getState().open(parse3x3('R U F')));
    press(' ', {}, screen.getByRole('button', { name: 'Reverse' }));
    expect(useAlgorithm.getState()).toMatchObject({ index: 0, playing: false });
    press('ArrowRight');
    expect(history()).toBe('R');
    press('ArrowLeft');
    expect(history()).toBe("R R'");
    press(' ');
    await waitFor(() => expect(useAlgorithm.getState()).toMatchObject({ index: 3, playing: false }));
    expect(useCube.getState().state).toEqual(applyMoves(cube.createSolved(), parse3x3('R U F')));
  });
});

describe('timer keys', () => {
  it('drive the timer and leave the cube alone', () => {
    useSettings.setState({ view: 'timer' });
    render(<Harness />);
    press(' ');
    expect(useTimer.getState()).toMatchObject({ phase: 'idle', armed: true });
    press(' ', { repeat: true }); // holding the key is still one press
    fireEvent.keyUp(document.body, { key: ' ' });
    expect(useTimer.getState().phase).toBe('running');
    press('r');
    expect(history()).toBe('');
    press(' ');
    expect(useTimer.getState().phase).toBe('idle');
    expect(useTimer.getState().solves).toHaveLength(1);
    fireEvent.keyUp(document.body, { key: ' ' });
    expect(useTimer.getState().phase).toBe('idle');

    press(' ');
    fireEvent.keyUp(document.body, { key: ' ' });
    press('Escape');
    expect(useTimer.getState().phase).toBe('idle');
    expect(useTimer.getState().solves).toHaveLength(1);
  });

  it('do not fire from the inspection field, and Space does not start playback in the timer', () => {
    useSettings.setState({ view: 'timer' });
    render(
      <Harness>
        <TimerPanel />
      </Harness>,
    );
    const field = screen.getByLabelText(/Inspection/);
    press(' ', {}, field);
    fireEvent.keyUp(field, { key: ' ' });
    expect(useTimer.getState()).toMatchObject({ phase: 'idle', armed: false });
    fireEvent.change(field, { target: { value: '8' } });
    expect(useSettings.getState().inspection).toBe(8);
    fireEvent.change(field, { target: { value: '500' } });
    expect(useSettings.getState().inspection).toBe(60);
  });
});

describe('playground panel', () => {
  it('explains a syntax error and refuses to run the algorithm', () => {
    render(<PlaygroundPanel />);
    fireEvent.change(algorithmField(), { target: { value: 'R U Q' } });
    expect(screen.getByRole('alert').textContent).toContain('"Q" is not a move');
    expect(screen.getByRole('alert').textContent).toContain('character 5');
    expect(algorithmField().getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Execute' }).disabled).toBe(true);
    fireEvent.keyDown(algorithmField(), { key: 'Enter' });
    expect(history()).toBe('');
    expect(useAlgorithm.getState().moves).toEqual([]);
  });

  it('runs a valid algorithm one move at a time and marks the current move', async () => {
    render(<PlaygroundPanel />);
    fireEvent.change(algorithmField(), { target: { value: "(R U R' U')2" } });
    expect(screen.getByText('8 moves')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Execute' }));
    await waitFor(() => expect(history()).toBe("R U R' U' R U R' U'"));
    expect(screen.getByTestId('playback-position').textContent).toBe('8 / 8');
    const playback = screen.getByRole('region', { name: 'Playback' });
    expect(playback.querySelector('[aria-current=step]')?.textContent).toBe("U'");
    expect(playback.querySelectorAll('li')).toHaveLength(8);
  });

  it('runs on Enter and reverses the algorithm in place', async () => {
    render(<PlaygroundPanel />);
    fireEvent.change(algorithmField(), { target: { value: "R U R' F2" } });
    fireEvent.click(screen.getByRole('button', { name: 'Reverse' }));
    expect(algorithmField().value).toBe("F2 R U' R'");
    fireEvent.keyDown(algorithmField(), { key: 'Enter' });
    await waitFor(() => expect(history()).toBe("F2 R U' R'"));
  });

  it('undoes, redoes and clears from the history section', () => {
    render(<PlaygroundPanel />);
    act(() => useCube.getState().turn(parse3x3('R U F')));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(history()).toBe('R U');
    fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
    expect(history()).toBe('R U F');
    expect(screen.getByRole<HTMLButtonElement>('button', { name: 'Redo' }).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(history()).toBe('');
    expect(useCube.getState().state).toEqual(applyMoves(cube.createSolved(), parse3x3('R U F')));
  });
});

describe('learn panel', () => {
  it('sets the stage, judges practice by the cube state and records progress', async () => {
    const view = render(<LearnPanel />);
    expect(useCube.getState().state).toEqual(applyMoves(cube.createSolved(), HOLD));
    expect(useCube.getState().dimmed?.size).toBe(16); // all but the centres and the white edges

    fireEvent.click(screen.getByRole('button', { name: 'Practice' }));
    expect(screen.getByRole('status').textContent).toContain('Solve the coloured pieces');
    act(() => useCube.getState().turn(parse3x3('U')));
    expect(useAlgorithm.getState().completedLessons).toEqual([]);
    act(() => useCube.getState().turn(parse3x3("U' F2")));
    expect(screen.getByRole('status').textContent).toContain('Step solved in 3 moves');
    expect(useAlgorithm.getState().completedLessons).toEqual(['white-cross']);
    expect(screen.getByRole('button', { name: 'Step 1: White cross, complete' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Next step/ }));
    expect(screen.getByRole('heading', { name: 'White corners' })).toBeTruthy();
    expect(useCube.getState().dimmed?.size).toBe(12);

    fireEvent.click(screen.getByRole('button', { name: 'Demo: White facing up' }));
    await waitFor(() => expect(screen.getByTestId('playback-position').textContent).toBe('12 / 12'));
    expect(cube.isSolved(useCube.getState().state)).toBe(true);

    view.unmount();
    expect(useCube.getState().dimmed).toBeNull();
  });

  it('asks for the 3×3 instead of teaching on another puzzle', () => {
    act(() => useCube.getState().setPuzzle('2x2'));
    render(<LearnPanel />);
    expect(useCube.getState().dimmed).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to the 3×3' }));
    expect(useCube.getState().puzzleId).toBe('3x3');
    expect(screen.getByRole('heading', { name: 'White cross' })).toBeTruthy();
  });
});

describe('algorithm lab', () => {
  it('lists every category, keeps favourites and demonstrates an algorithm to a solved cube', async () => {
    act(() => useCube.getState().setPuzzle('2x2'));
    render(<LabPanel />);
    expect(screen.getByRole('heading', { name: 'Sune' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'PLL' }));
    expect(screen.getAllByRole('button', { name: /^Execute / })).toHaveLength(21);

    fireEvent.click(screen.getAllByRole('button', { name: 'Add to favourites' })[0]);
    expect(useAlgorithm.getState().favourites).toEqual(['pll-ua']);
    fireEvent.click(screen.getByRole('tab', { name: 'Favourites' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Remove from favourites' }));
    expect(screen.getByText(/No favourites yet/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'PLL' }));
    fireEvent.click(screen.getByRole('button', { name: 'Execute T perm' }));
    expect(useCube.getState().puzzleId).toBe('3x3');
    await waitFor(() => expect(screen.getByTestId('playback-position').textContent).toBe('14 / 14'));
    expect(cube.isSolved(useCube.getState().state)).toBe(true);
  });
});

describe('timer panel', () => {
  it('shows per-puzzle statistics and deletes single solves', () => {
    const solve = (ms: number, puzzle: '3x3' | '2x2' = '3x3') => ({ id: `${puzzle}-${ms}`, ms, scramble: 'R U', puzzle, at: 0 });
    useTimer.setState({ solves: [solve(30_000), solve(10_000), solve(50_000), solve(20_000), solve(40_000), solve(4000, '2x2')] });
    render(<TimerPanel />);
    const stats = () => screen.getByRole('region', { name: 'Statistics' }).textContent;
    expect(stats()).toContain('Solves5');
    expect(stats()).toContain('Best10.00');
    expect(stats()).toContain('Mean30.00');
    expect(stats()).toContain('Average of 530.00');
    expect(stats()).toContain('Average of 12–');
    expect(screen.getAllByText('PB')).toHaveLength(1);
    // One bar per bin, and together they account for every solve.
    const bars = screen.getAllByLabelText(/s: \d+ solves?$/);
    expect(bars.reduce((sum, bar) => sum + Number(/: (\d+) solve/.exec(bar.getAttribute('aria-label')!)![1]), 0)).toBe(5);

    fireEvent.click(screen.getByRole('button', { name: 'Delete solve 2' })); // the 10-second best
    expect(useTimer.getState().solves.map((s) => s.ms)).toEqual([30_000, 50_000, 20_000, 40_000, 4000]);
    expect(stats()).toContain('Best20.00');
    expect(stats()).toContain('Average of 5–');
  });
});

describe('settings panel', () => {
  it('rebinds a key without the keypress reaching the cube', () => {
    render(
      <Harness>
        <SettingsPanel />
      </Harness>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Key for R, Right face: r' }));
    expect(screen.getByRole('status').textContent).toContain('Press a key for R');
    press('Shift'); // a modifier on its own is not a binding
    press('j');
    expect(useSettings.getState().keymap.R).toBe('j');
    expect(history()).toBe('');
    press('j');
    press('r');
    expect(history()).toBe('R');

    fireEvent.click(screen.getByRole('button', { name: 'Key for U, Up face: u' }));
    press('Escape');
    expect(useSettings.getState().keymap.U).toBe('u');
    fireEvent.click(screen.getByRole('button', { name: 'Key for U, Up face: u' }));
    press('Backspace');
    expect(useSettings.getState().keymap.U).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Restore defaults' }));
    expect(useSettings.getState().keymap).toEqual(DEFAULT_KEYMAP);
  });

  it('deletes saved data only after confirmation', () => {
    useTimer.setState({ solves: [{ id: 'a', ms: 1000, scramble: 'R', puzzle: '3x3', at: 0 }] });
    render(<SettingsPanel />);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all solves' }));
    expect(useTimer.getState().solves).toHaveLength(1);
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete all solves' }));
    expect(useTimer.getState().solves).toEqual([]);
    confirm.mockRestore();
  });
});
