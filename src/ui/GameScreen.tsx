import { useState, type ReactNode } from 'react';
import { goBack } from '../app/router';
import { IconBack, IconHelp, IconMore } from './icons';
import { Sheet } from './Sheet';

export interface MenuItem {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
  disabled?: boolean;
}

export interface GameScreenProps {
  title: string;
  /** Small line under the title, e.g. "No. 44 · Oct 14" or "2 players". */
  kicker?: string;
  /** Rules shown from the ? button. Keep it short. */
  rules: ReactNode;
  /** Where Back goes if there's no in-app history. */
  backTo: string;
  menu?: MenuItem[];
  /** Open the rules sheet on first visit. */
  rulesInitiallyOpen?: boolean;
  children: ReactNode;
  /** Extra class on the content area, for per-game layout. */
  className?: string;
}

/** Shared chrome for every daily puzzle and game-room game. */
export function GameScreen({ title, kicker, rules, backTo, menu, rulesInitiallyOpen = false, children, className = '' }: GameScreenProps) {
  const [rulesOpen, setRulesOpen] = useState(rulesInitiallyOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="game-screen">
      <header className="game-bar">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => goBack(backTo)}>
          <IconBack />
        </button>
        <div className="game-bar__title">
          <h1 className="display">{title}</h1>
          {kicker && <p className="game-bar__kicker">{kicker}</p>}
        </div>
        <div className="game-bar__actions">
          <button type="button" className="icon-btn" aria-label="How to play" onClick={() => setRulesOpen(true)}>
            <IconHelp />
          </button>
          {menu && menu.length > 0 && (
            <button type="button" className="icon-btn" aria-label="Game options" onClick={() => setMenuOpen(true)}>
              <IconMore />
            </button>
          )}
        </div>
      </header>
      <main className={`game-body ${className}`.trim()}>{children}</main>
      <Sheet open={rulesOpen} onClose={() => setRulesOpen(false)} title={`How to play ${title}`}>
        <div className="rules">{rules}</div>
      </Sheet>
      {menu && (
        <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={title}>
          <ul className="menu-list">
            {menu.map((m) => (
              <li key={m.label}>
                <button
                  type="button"
                  className={`menu-list__item${m.destructive ? ' is-destructive' : ''}`}
                  disabled={m.disabled}
                  onClick={() => {
                    setMenuOpen(false);
                    m.onSelect();
                  }}
                >
                  {m.label}
                </button>
              </li>
            ))}
          </ul>
        </Sheet>
      )}
    </div>
  );
}
