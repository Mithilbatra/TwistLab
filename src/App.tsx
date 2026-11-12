import { useEffect, type ComponentType } from 'react';
import { Viewport } from './components/cube/Viewport';
import { BottomBar } from './components/layout/BottomBar';
import { Sidebar } from './components/layout/Sidebar';
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
 */
export function App() {
  useKeyboard();
  const view = useSettings((s) => s.view);
  const Panel = PANELS[view];

  // A loaded sequence belongs to the section that loaded it.
  useEffect(() => () => useAlgorithm.getState().close(), [view]);

  return (
    <div className="grid h-dvh grid-rows-[minmax(0,1fr)_auto] md:grid-cols-[auto_minmax(0,1fr)] md:grid-rows-1">
      <Sidebar />
      <div className="grid min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-1">
        <main className="flex min-h-0 min-w-0 flex-col">
          <TopBar />
          {view === 'timer' && <TimerDisplay />}
          <Viewport />
          <BottomBar />
        </main>
        <aside aria-label="Controls" className="min-h-0 overflow-y-auto border-t border-line bg-panel lg:border-t-0 lg:border-l">
          <Panel />
        </aside>
      </div>
    </div>
  );
}
