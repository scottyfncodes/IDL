import type { ReactNode } from 'react';
import { href } from './router';
import { IconLibrary, IconPlayRoom, IconToday } from '../ui/icons';

export type Tab = 'today' | 'play' | 'library';

const TABS: { id: Tab; label: string; to: string; Icon: typeof IconToday }[] = [
  { id: 'today', label: 'Today', to: '/today', Icon: IconToday },
  { id: 'play', label: 'Play', to: '/play', Icon: IconPlayRoom },
  { id: 'library', label: 'Library', to: '/library', Icon: IconLibrary },
];

/** Layout for the three top-level destinations: content + bottom tab bar
 * on phones, top bar on wide screens. */
export function TabLayout({ active, children }: { active: Tab; children: ReactNode }) {
  return (
    <div className="tab-layout">
      <div className="tab-layout__content">{children}</div>
      <nav className="tabbar" aria-label="Main">
        <ul className="tabbar__list">
          {TABS.map(({ id, label, to, Icon }) => (
            <li key={id}>
              <a className="tabbar__link" href={href(to)} aria-current={active === id ? 'page' : undefined}>
                <Icon size={24} />
                <span>{label}</span>
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
