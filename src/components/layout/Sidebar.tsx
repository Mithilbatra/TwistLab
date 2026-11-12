import { Box, FlaskConical, GraduationCap, LayoutGrid, Settings, Timer, type LucideIcon } from 'lucide-react';
import { useSettings, type View } from '../../store/settingsStore';
import { cx, Logo } from '../ui/ui';

const NAV: readonly { view: View; label: string; icon: LucideIcon }[] = [
  { view: 'playground', label: 'Playground', icon: Box },
  { view: 'lab', label: 'Algorithm Lab', icon: FlaskConical },
  { view: 'learn', label: 'Learn', icon: GraduationCap },
  { view: 'timer', label: 'Timer & Statistics', icon: Timer },
  { view: 'library', label: 'Puzzle Library', icon: LayoutGrid },
  { view: 'settings', label: 'Settings', icon: Settings },
];

/** Section navigation: a rail on the left from tablet up, a tab bar along the bottom on phones. */
export function Sidebar() {
  const view = useSettings((s) => s.view);
  const setView = useSettings((s) => s.setView);
  return (
    <nav
      aria-label="Sections"
      className="order-last flex border-t border-line bg-panel md:order-none md:w-14 md:flex-col md:border-t-0 md:border-r xl:w-52"
    >
      <div className="hidden h-12 shrink-0 items-center gap-2.5 border-b border-line px-4 md:flex">
        <Logo />
        <span className="hidden text-[15px] font-semibold tracking-tight text-zinc-50 xl:block">TwistLab</span>
      </div>
      <ul className="flex flex-1 justify-around md:flex-col md:justify-start md:gap-0.5 md:p-2">
        {NAV.map(({ view: target, label, icon: Icon }) => {
          const active = view === target;
          return (
            <li key={target} className={cx('flex-1 md:flex-none', target === 'settings' && 'md:mt-auto')}>
              <button
                type="button"
                title={label}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                onClick={() => setView(target)}
                className={cx(
                  'relative flex h-12 w-full items-center justify-center gap-3 px-3 transition-colors md:h-9 md:rounded-md xl:justify-start',
                  active ? 'text-zinc-50 md:bg-white/[0.07]' : 'text-zinc-500 hover:text-zinc-200 md:hover:bg-white/[0.04]',
                )}
              >
                {active && (
                  <span className="absolute inset-x-4 top-0 h-px bg-accent md:inset-x-auto md:top-2 md:bottom-2 md:-left-2 md:h-auto md:w-0.5 md:rounded-r" />
                )}
                <Icon size={17} strokeWidth={1.75} className="shrink-0" />
                <span className="hidden truncate xl:inline">{label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
