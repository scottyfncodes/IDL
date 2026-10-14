import type { Coat, Hat, Holding, Suspect } from './logic';

const COAT_FILL: Record<Coat, string> = {
  red: 'var(--clay)',
  green: 'var(--moss)',
  blue: 'var(--tide)',
  yellow: 'var(--ochre)',
};

function HatShape({ hat }: { hat: Hat }) {
  switch (hat) {
    case 'cap':
      return (
        <g className="dd-fig__hat">
          <path d="M19 26a11 10 0 0 1 22 0z" />
          <path d="M39 25.5h9a2 2 0 0 1 0 3H39z" />
        </g>
      );
    case 'beret':
      return (
        <g className="dd-fig__hat">
          <ellipse cx="29" cy="22.5" rx="14" ry="5" transform="rotate(-8 29 22.5)" />
          <path d="M29 17.5v-3" strokeLinecap="round" />
        </g>
      );
    case 'bobble':
      return (
        <g className="dd-fig__hat">
          <path d="M19.5 27a10.5 12 0 0 1 21 0z" />
          <path d="M19 25h22v3.5H19z" />
          <circle cx="30" cy="12.5" r="3.6" />
        </g>
      );
    default:
      // Bare head: a simple hair line.
      return <path className="dd-fig__hair" d="M20.5 27c1-8 18-8 19 0" />;
  }
}

function HeldItem({ holding }: { holding: Holding }) {
  switch (holding) {
    case 'umbrella':
      return (
        <g className="dd-fig__item">
          <path d="M51 52v33a3 3 0 0 1-6 0" fill="none" />
          <path d="M51 46l-5 12h10z" />
        </g>
      );
    case 'book':
      return (
        <g className="dd-fig__item">
          <rect x="43" y="62" width="12" height="15" rx="1.5" />
          <path d="M46 66h6M46 69.5h6" fill="none" />
        </g>
      );
    case 'basket':
      return (
        <g className="dd-fig__item">
          <path d="M44 74a6 7 0 0 1 12 0" fill="none" />
          <path d="M42 74h16l-2.5 10h-11z" />
          <path d="M44.5 78h11" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

/** Stylised lineup figure. Purely decorative; text labels carry the meaning. */
export function SuspectFigure({ suspect }: { suspect: Suspect }) {
  const holdsSomething = suspect.holding !== 'nothing';
  return (
    <svg className="dd-fig" viewBox="0 0 60 100" aria-hidden="true" focusable="false">
      {/* legs */}
      <path className="dd-fig__line" d="M25 86v11M35 86v11" />
      {/* arms */}
      <path className="dd-fig__line" d="M19 47l-6 24" />
      <path className="dd-fig__line" d={holdsSomething ? 'M41 47l7 22' : 'M41 47l6 24'} />
      {/* coat */}
      <path className="dd-fig__coat" style={{ fill: COAT_FILL[suspect.coat] }} d="M21 42h18l6 44a2 2 0 0 1-2 2H17a2 2 0 0 1-2-2z" />
      <path className="dd-fig__seam" d="M30 43v44" />
      {/* head */}
      <circle className="dd-fig__head" cx="30" cy="29" r="10" />
      <HatShape hat={suspect.hat} />
      <HeldItem holding={suspect.holding} />
    </svg>
  );
}
