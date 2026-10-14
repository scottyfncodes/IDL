import { MAX_ACCUSATIONS } from './logic';

export function DeductionRules() {
  return (
    <>
      <p>Something has gone wrong, and everyone present is standing in a row, numbered left to right. Every clue is true of the culprit.</p>
      <ul>
        <li>Tap a suspect to cross them off as you reason. Crossing off is just a note — it’s free.</li>
        <li>When you’re sure, make an accusation. “Next to” means directly beside; “left of” means anywhere further left.</li>
        <li>A wrong accusation tells you which clue clears that person. You have {MAX_ACCUSATIONS} accusations.</li>
        <li>Each day’s clues point to exactly one person, and every clue matters.</li>
      </ul>
    </>
  );
}
