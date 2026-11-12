import { useEffect, type ComponentType } from 'react';
import { Viewport } from './components/cube/Viewport';
import { BottomBar } from './components/layout/BottomBar';
import { NAV, Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { TimerDisplay } from './components/timer/TimerDisplay';
import { useKeyboard } from './hooks/useKeyboard';
import { LabPanel } from './pages/LabPanel';
import { LearnPanel } from './pages/LearnPanel';
import { LibraryPanel } from './pages/LibraryPanel';
import { PlaygroundPanel } from './pages/PlaygroundPanel';
import { SettingsPanel } from './pages/SettingsPanel';
import { TimerPanel } from './pages/TimerPanel';
import { useAlgorithm } from './store/algorithmStore';
import { useSettings, type View } from './store/settingsStore';

const PANELS: Record<View, ComponentType> = {
  playground: PlaygroundPanel,
  lab: LabPanel,
  learn: LearnPanel,
  timer: TimerPanel,
  library: LibraryPanel,
  settings: SettingsPanel,
};

/**
 * One shell for every section. The puzzle stays on stage in the middle and never
 * remounts; choosing a section only swaps the panel beside it.
 *
 * Each section is a face of the cube. Its sticker colour, set here with data-sticker,
 * becomes the accent of the whole interface while that section is open.
 */
export function App() {
  useKeyboard();
  const view = useSettings((s) => s.view);
  const Panel = PANELS[view];
  const number = NAV.findIndex((item) => item.view === view) + 1;
  const { label, icon: Icon, face } = NAV[number - 1];

  // A loaded sequence belongs to the section that loaded it.
  useEffect(() => () => useAlgorithm.getState().close(), [view]);

  return (
    <div
      data-sticker={face}
      className="app grid h-dvh grid-rows-[minmax(0,1fr)_auto] gap-1.5 p-1.5 md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-1 md:gap-2 md:p-2"
    >
      <Sidebar />
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-1.5 md:gap-2 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <main className="flex min-h-0 min-w-0 flex-col gap-1.5 md:gap-2">
          <TopBar />
          <div className="tile flex min-h-0 flex-1 flex-col overflow-hidden">
            {view === 'timer' && <TimerDisplay />}
            <Viewport />
            <BottomBar />
          </div>
        </main>
        <aside aria-label="Controls" className="tile flex min-h-0 flex-col overflow-hidden">
          {/* The face that is showing, named in its own colour. Decoration: the navigation already says where you are. */}
          <div
            aria-hidden="true"
            className="relative flex h-9 shrink-0 items-center overflow-hidden bg-accent px-4 text-accent-ink transition-colors duration-300 lg:h-[5.5rem] lg:items-end lg:pb-3"
          >
            <div>
              <div className="hidden font-mono text-[10px] font-semibold tracking-[0.2em] lg:block">
                FACE 0{number} / 0{NAV.length}
              </div>
              <div className="display text-xl whitespace-nowrap uppercase lg:mt-1.5 lg:text-[28px]">{label}</div>
            </div>
            <Icon strokeWidth={1.5} className="absolute -right-3 -bottom-6 size-28 opacity-15 max-lg:hidden" />
          </div>
          <div key={view} className="min-h-0 flex-1 animate-face-in overflow-y-auto motion-reduce:animate-none">
            <Panel />
          </div>
        </aside>
      </div>
    </div>
  );
}
