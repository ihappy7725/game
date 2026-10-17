import { shuffled, VOCAB, type VocabItem } from "./vocab";

export function wordChoices(item: VocabItem, count: 2 | 3) {
  // 뜻만 있는 CSV도 갈림길에는 항상 영어 표제어로 표시합니다.
  const candidates = shuffled(VOCAB.filter(other => other.word !== item.word));
  const preferred = candidates.filter(other => other.meaning !== item.meaning && other.synonym !== item.synonym);
  const distractors = [...new Set([...preferred, ...candidates].map(other => other.word))].slice(0, count - 1);
  const choices = [item.word, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return { choices, correct: choices.indexOf(item.word) };
}

export const forkDuration = (difficulty: number, cleared: number) => Math.max([1400,1100,900][difficulty], [3800, 3100, 2500][difficulty] - cleared * 100);

/** 오답 추락은 체력과 무관합니다. 체력은 시간·맞바람·보급에만 사용합니다. */
export function forkEnergy(energy: number, elapsedMs: number, supply: boolean, wind: boolean) {
  return Math.max(0, Math.min(100, energy - elapsedMs / 1000 * 2.2 + (supply ? 24 : 0) - (wind ? 12 : 0)));
}
