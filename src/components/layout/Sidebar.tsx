import { Box, FlaskConical, GraduationCap, LayoutGrid, Settings, Timer, type LucideIcon } from 'lucide-react';
import { useSettings, type View } from '../../store/settingsStore';
import { cx, Logo } from '../ui/ui';

/** The six sections. Each is one face of the cube: `face` picks its sticker colour (see index.css). */
export const NAV: readonly { view: View; label: string; short: string; icon: LucideIcon; face: number }[] = [
  { view: 'playground', label: 'Playground', short: 'Play', icon: Box, face: 4 },
  { view: 'lab', label: 'Algorithm Lab', short: 'Lab', icon: FlaskConical, face: 5 },
  { view: 'learn', label: 'Learn', short: 'Learn', icon: GraduationCap, face: 3 },
  { view: 'timer', label: 'Timer & Statistics', short: 'Timer', icon: Timer, face: 0 },
  { view: 'library', label: 'Puzzle Library', short: 'Library', icon: LayoutGrid, face: 1 },
  { view: 'settings', label: 'Settings', short: 'Settings', icon: Settings, face: 2 },
];

/** Section navigation as a column of six stickers: down the left from tablet up, along the bottom on phones. */
export function Sidebar() {
  const view = useSettings((s) => s.view);
  const setView = useSettings((s) => s.setView);
  return (
    <nav aria-label="Sections" className="order-last flex min-h-0 gap-1.5 md:order-none md:w-[4.5rem] md:flex-col md:gap-2">
      <div className="tile hidden h-12 shrink-0 items-center justify-center md:flex">
        <Logo />
      </div>
      <ul className="flex min-h-0 flex-1 gap-1.5 md:flex-col md:gap-2">
        {NAV.map(({ view: target, label, short, icon: Icon, face }, i) => {
          const active = view === target;
          return (
            // The face on show takes more of the rail than the five waiting behind it.
            <li
              key={target}
              className={cx('min-h-0 min-w-0 basis-0 transition-[flex-grow] duration-300 ease-out motion-reduce:transition-none', active ? 'grow-[2.4]' : 'grow')}
            >
              <button
                type="button"
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                data-sticker={face}
                onClick={() => setView(target)}
                className="facet flex h-12 w-full items-center justify-center gap-2 overflow-hidden px-2 md:h-full md:flex-col md:px-0 md:py-2.5"
              >
                <span aria-hidden="true" className="hidden font-mono text-[10px] font-semibold tracking-wider opacity-70 md:block">
                  0{i + 1}
                </span>
                <span className="flex items-center md:flex-1">
                  <Icon size={19} strokeWidth={2} className="shrink-0" />
                </span>
                {active && (
                  <>
                    <span aria-hidden="true" className="truncate font-mono text-[11px] font-bold tracking-wider uppercase md:hidden">
                      {short}
                    </span>
                    <span
                      aria-hidden="true"
                      className="facet-name display rotate-180 text-[21px] uppercase [writing-mode:vertical-rl]"
                    >
                      {short}
                    </span>
                  </>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
