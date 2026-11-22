// How the lock answers a try (design §3, §8). Right-place letters are settled first, then each
// remaining letter of the try claims one unclaimed copy in the answer, left to right, so two
// copies in a try are only both marked when the answer really has two.

export type Mark = 'gold' | 'blue' | 'pewter';
const RANK: Record<Mark, number> = { pewter: 0, blue: 1, gold: 2 };

export function markTry(guess: string, answer: string): Mark[] {
  const guessLetters = [...guess];
  const answerLetters = [...answer];
  const marks: Mark[] = guessLetters.map((letter, index) => (letter === answerLetters[index] ? 'gold' : 'pewter'));
  const unclaimed = new Map<string, number>();
  answerLetters.forEach((letter, index) => {
    if (marks[index] !== 'gold') unclaimed.set(letter, (unclaimed.get(letter) ?? 0) + 1);
  });
  guessLetters.forEach((letter, index) => {
    const copies = unclaimed.get(letter) ?? 0;
    if (marks[index] === 'gold' || copies === 0) return;
    marks[index] = 'blue';
    unclaimed.set(letter, copies - 1);
  });
  return marks;
}

/** Each letter's best mark over every try: what its keyboard key shows. */
export function bestMarks(tries: string[], answer: string): Map<string, Mark> {
  const best = new Map<string, Mark>();
  for (const guess of tries) {
    markTry(guess, answer).forEach((mark, index) => {
      const letter = [...guess][index]!;
      const before = best.get(letter);
      if (!before || RANK[mark] > RANK[before]) best.set(letter, mark);
    });
  }
  return best;
}

/** Tries in a row, counted back from the latest, that latched no new gold: the lantern's cue (§6d). */
export function triesWithoutNewGold(tries: string[], answer: string): number {
  const gold = new Set<number>();
  let streak = 0;
  for (const guess of tries) {
    const fresh = markTry(guess, answer).filter((mark, index) => mark === 'gold' && !gold.has(index) && gold.add(index)).length;
    streak = fresh ? 0 : streak + 1;
  }
  return streak;
}
