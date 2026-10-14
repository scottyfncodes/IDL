import { useEffect } from 'react';
import { IconBackspace } from './icons';

export type KeyState = 'correct' | 'present' | 'absent' | undefined;
export type KeyPress = { type: 'letter'; letter: string } | { type: 'enter' } | { type: 'back' };

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];

export interface KeyboardProps {
  onKey: (k: KeyPress) => void;
  states?: Record<string, KeyState>;
  disabled?: boolean;
  enterLabel?: string;
}

/** On-screen keyboard shared by the word games. */
export function Keyboard({ onKey, states = {}, disabled, enterLabel = 'Enter' }: KeyboardProps) {
  return (
    <div className="kb no-select" role="group" aria-label="Keyboard">
      {ROWS.map((row, i) => (
        <div className="kb__row" key={row}>
          {i === 2 && (
            <button type="button" className="kb__key kb__key--wide" disabled={disabled} onClick={() => onKey({ type: 'enter' })}>
              {enterLabel}
            </button>
          )}
          {[...row].map((l) => {
            const st = states[l];
            return (
              <button
                type="button"
                key={l}
                className="kb__key"
                data-state={st}
                disabled={disabled}
                aria-label={st ? `${l.toUpperCase()}, ${st}` : l.toUpperCase()}
                onClick={() => onKey({ type: 'letter', letter: l })}
              >
                {l}
              </button>
            );
          })}
          {i === 2 && (
            <button type="button" className="kb__key kb__key--wide" aria-label="Delete" disabled={disabled} onClick={() => onKey({ type: 'back' })}>
              <IconBackspace size={20} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

/** Forward physical keyboard presses (ignores typing in inputs and modifier chords). */
export function usePhysicalKeyboard(onKey: (k: KeyPress) => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Enter') {
        // Let Enter activate a focused button normally.
        if (t && t.tagName === 'BUTTON') return;
        e.preventDefault();
        onKey({ type: 'enter' });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        onKey({ type: 'back' });
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        onKey({ type: 'letter', letter: e.key.toLowerCase() });
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey, enabled]);
}
