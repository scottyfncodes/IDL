import { createContext } from 'react';

/** Which game's art a screen should use, set by the route that opens it. */
export const GameArtContext = createContext<string | null>(null);
