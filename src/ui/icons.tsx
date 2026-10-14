import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 22, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
  ...rest,
});

export const IconBack = (p: P) => (<svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>);
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>);
export const IconHelp = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.1-2.4 3.6" /><circle cx="12" cy="17" r="0.6" fill="currentColor" /></svg>);
export const IconMore = (p: P) => (<svg {...base(p)}><circle cx="5" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" /><circle cx="19" cy="12" r="1.2" fill="currentColor" /></svg>);
export const IconShare = (p: P) => (<svg {...base(p)}><path d="M12 4v11M7.5 8.5L12 4l4.5 4.5" /><path d="M6 12.5V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6.5" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>);
export const IconClose = (p: P) => (<svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>);
export const IconRefresh = (p: P) => (<svg {...base(p)}><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" /><path d="M19.5 4.5v4h-4" /></svg>);
export const IconOffline = (p: P) => (<svg {...base(p)}><path d="M3 3l18 18" /><path d="M8.5 16.5a5 5 0 0 1 7 0M5 12.9a10 10 0 0 1 4-2.4M12.5 10a10 10 0 0 1 6.5 2.9M2 9.3a15 15 0 0 1 4-2.6M10.5 5.6A15 15 0 0 1 22 9.3" /><circle cx="12" cy="20" r="0.8" fill="currentColor" /></svg>);
export const IconSun = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></svg>);
export const IconMoon = (p: P) => (<svg {...base(p)}><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" /></svg>);
export const IconBackspace = (p: P) => (<svg {...base(p)}><path d="M8.5 5H20a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8.5L3 12z" /><path d="M11.5 9.5l5 5M16.5 9.5l-5 5" /></svg>);
export const IconUndo = (p: P) => (<svg {...base(p)}><path d="M9 7L4.5 11.5 9 16" /><path d="M5 11.5h9.5a5 5 0 0 1 0 10H12" /></svg>);
export const IconPencil = (p: P) => (<svg {...base(p)}><path d="M4 20l1-4.5L15.5 5a2 2 0 0 1 3 0l.5.5a2 2 0 0 1 0 3L8.5 19z" /><path d="M13.5 7l3.5 3.5" /></svg>);
export const IconEraser = (p: P) => (<svg {...base(p)}><path d="M8 20h12" /><path d="M4.5 15.5l9-9a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8L12 18H7z" /><path d="M9 11l5 5" /></svg>);
export const IconLightbulb = (p: P) => (<svg {...base(p)}><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>);
export const IconPause = (p: P) => (<svg {...base(p)}><path d="M9 5v14M15 5v14" /></svg>);
export const IconPlay = (p: P) => (<svg {...base(p)}><path d="M7 5l12 7-12 7z" /></svg>);
export const IconShuffle = (p: P) => (<svg {...base(p)}><path d="M3 7h3.5c4 0 7 10 11 10H21M3 17h3.5c1.6 0 2.9-1.6 4-3.6M13.5 9.6c1.1-1.4 2.4-2.6 4-2.6H21" /><path d="M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5" /></svg>);
export const IconRotate = (p: P) => (<svg {...base(p)}><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1" /><path d="M17.8 3v4h-4" /><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1" /><path d="M6.2 21v-4h4" /></svg>);

// Navigation glyphs
export const IconToday = (p: P) => (<svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="2.5" /><path d="M4 9.5h16M8.5 3v4M15.5 3v4" /><circle cx="12" cy="14.5" r="1.8" fill="currentColor" stroke="none" /></svg>);
export const IconPlayRoom = (p: P) => (<svg {...base(p)}><rect x="3.5" y="7" width="17" height="11" rx="5.5" /><path d="M8 10.5v4M6 12.5h4" /><circle cx="15.5" cy="11.2" r="0.9" fill="currentColor" /><circle cx="17.2" cy="13.8" r="0.9" fill="currentColor" /></svg>);
export const IconLibrary = (p: P) => (<svg {...base(p)}><path d="M5 4.5v15M9 4.5v15" /><path d="M13 5.2l3.6-.9 3.4 14.6-3.6.9z" /></svg>);
