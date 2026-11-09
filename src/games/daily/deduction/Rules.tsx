import { MAX_ACCUSATIONS } from './logic';

export function DeductionRules() {
  return (
    <>
      <p>Something has gone wrong, and everyone present is standing in a row, numbered left to right. Two of them were in on it: the culprit, and a lookout who kept watch. They are never the same person. Every clue is true.</p>
      <ul>
        <li>Some clues describe the culprit, some the lookout, and some say how the two stood: “directly next to”, “exactly one person between”, or “wore coats of the same colour”. “The same kind of hat” means both wore one.</li>
        <li>No clue about the culprit is enough on its own. Pin down the lookout, then use it to find the culprit.</li>
        <li>“Next to” means directly beside; “to the left of” means anywhere further left. “Exactly two people to the left of the culprit wore caps” counts everyone on that side, lookout included.</li>
        <li>Tap a suspect to cross them off as you reason. Crossing off is just a note, so it’s free.</li>
        <li>A wrong accusation tells you which clues clear that person. You have {MAX_ACCUSATIONS} accusations.</li>
        <li>Each day’s clues point to exactly one person, and every clue matters. Cases before 12 November 2026 have no lookout: every clue there is about the culprit.</li>
      </ul>
    </>
  );
}
