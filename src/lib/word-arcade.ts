import { type VocabItem } from "./vocab";

export function wordChoices(item: VocabItem, count: 2 | 3) {
  const choices = [item.word, ...item.decoys.slice(0, count - 1)];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, correct: choices.indexOf(item.word) };
}

export const forkDuration = (difficulty: number, cleared: number) => Math.max(1600, [3800, 3100, 2500][difficulty] - Math.floor(cleared / 4) * 140);
export const subwayDuration = (difficulty: number, cleared: number) => Math.max(1400, [3400, 2800, 2200][difficulty] - Math.floor(cleared / 4) * 120);

/** 오답 추락은 체력과 무관합니다. 체력은 시간·낙석·보급에만 사용합니다. */
export function forkEnergy(energy: number, elapsedMs: number, supply: boolean, rock: boolean, jumped: boolean) {
  return Math.max(0, Math.min(100, energy - elapsedMs / 1000 * 2.2 + (supply ? 24 : 0) - (rock && !jumped ? 22 : 0)));
}
