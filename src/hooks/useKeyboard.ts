import { useEffect } from 'react';
import { useAlgorithm } from '../store/algorithmStore';
import { currentPuzzle, useCube } from '../store/cubeStore';
import { useSettings } from '../store/settingsStore';
import { useTimer } from '../store/timerStore';

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

const matches = (target: EventTarget | null, selector: string) => target instanceof Element && target.matches(selector);

/** Somewhere text is being entered: every shortcut stands down. */
const isTyping = (target: EventTarget | null) =>
  matches(target, 'textarea, select, [contenteditable=""], [contenteditable="true"]') ||
  matches(target, 'input:not([type=range], [type=checkbox], [type=radio], [type=button])');

/** A focused control that already uses Space and the arrow keys itself. */
const isControl = (target: EventTarget | null) => matches(target, 'button, a[href], input, summary, [role=button]');

function onKeyDown(event: KeyboardEvent) {
  if (isTyping(event.target)) return;
  // Alt changes the character a key produces on macOS (Alt+R is "®"), so read the physical key instead.
  const key = event.altKey && /^Key[A-Z]$/.test(event.code) ? event.code[3].toLowerCase() : event.key.toLowerCase();
  const cube = useCube.getState();
  const { view, keymap } = useSettings.getState();

  if (event.metaKey || event.ctrlKey) {
    if (key !== 'z' && key !== 'y') return;
    event.preventDefault();
    if (view === 'timer') return;
    if (key === 'y' || event.shiftKey) cube.redo();
    else cube.undo();
    return;
  }

  // In the timer the cube only previews the scramble, so Space and Escape are the only live keys.
  if (view === 'timer') {
    if (key === 'escape') useTimer.getState().cancel();
    if (key !== ' ' || isControl(event.target)) return;
    event.preventDefault();
    if (!event.repeat) useTimer.getState().press();
    return;
  }

  if (!isControl(event.target)) {
    const playback = useAlgorithm.getState();
    if (key === ' ') {
      event.preventDefault();
      if (playback.playing) playback.pause();
      else void playback.play();
      return;
    }
    if (key === 'arrowright' && !playback.playing) return playback.next();
    if (key === 'arrowleft' && !playback.playing) return playback.previous();
  }

  if (event.repeat) return;
  const family = Object.keys(keymap).find((name) => keymap[name] === key);
  if (!family) return;
  const wide = event.altKey && 'RLUDFB'.includes(family);
  const parsed = currentPuzzle().parse((wide ? family.toLowerCase() : family) + (event.shiftKey ? "'" : ''));
  if (!parsed.ok) return; // this puzzle has no such move (M on a 2×2)
  event.preventDefault();
  cube.turn(parsed.moves);
}

function onKeyUp(event: KeyboardEvent) {
  if (event.key !== ' ' || useSettings.getState().view !== 'timer' || isTyping(event.target)) return;
  if (isControl(event.target)) return;
  event.preventDefault();
  useTimer.getState().release();
}

// A button clicked with the mouse keeps focus, and would then swallow Space. Hand focus back to the page.
function onClick(event: MouseEvent) {
  if (event.detail > 0 && document.activeElement instanceof HTMLButtonElement) document.activeElement.blur();
}

/** Installs the global shortcuts: cube turns, playback, undo/redo and the timer. Mount once. */
export function useKeyboard() {
  useEffect(() => {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('click', onClick);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('click', onClick);
    };
  }, []);
}
