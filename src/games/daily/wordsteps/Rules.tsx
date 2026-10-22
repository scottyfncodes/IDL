import { EXTRA_MOVES } from './logic';

export function WordstepsRules() {
  return (
    <>
      <p>Climb from the top word to the goal word, changing one letter at a time.</p>
      <ul>
        <li>Each step swaps exactly <strong>one letter in place</strong>, no adding, removing or rearranging.</li>
        <li>Every step must be a real four-letter word, and you can’t reuse a word already on your ladder.</li>
        <li><strong>Par</strong> is the fewest steps possible using everyday words. You have par + {EXTRA_MOVES} moves.</li>
        <li>Stuck? Undo your last step and try another route.</li>
      </ul>
    </>
  );
}
