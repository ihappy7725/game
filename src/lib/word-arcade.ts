import { VOCAB, type VocabItem } from "./vocab";

/** 보기 후보만 무작위로 뽑습니다. 단어장이 커져도 한 문제당 비용이 일정합니다. */
function sample(pool: readonly VocabItem[], size: number, exclude: string): VocabItem[] {
  const picked = new Map<string, VocabItem>();
  for (let tries = 0; tries < size * 6 && picked.size < size; tries += 1) {
    const candidate = pool[Math.floor(Math.random() * pool.length)];
    if (candidate && candidate.word !== exclude) picked.set(candidate.word, candidate);
  }
  return [...picked.values()];
}

export function wordChoices(item: VocabItem, count: 2 | 3) {
  // 뜻만 있는 CSV도 갈림길에는 항상 영어 표제어로 표시합니다.
  // 4,000단어 전체를 섞는 대신 필요한 수만큼만 무작위로 뽑습니다.
  const candidates = sample(VOCAB, (count - 1) * 8 + 8, item.word);
  const preferred = candidates.filter(other => other.meaning !== item.meaning && other.synonym !== item.synonym);
  const distractors = preferred.map(other => other.word).slice(0, count - 1);
  // 고정 난수·작은 후보 묶음에서도 같은 뜻을 오답에 섞거나 보기 수를 줄이지 않습니다.
  if (distractors.length < count - 1) for (const other of VOCAB) {
    if (other.word !== item.word && other.meaning !== item.meaning && other.synonym !== item.synonym && !distractors.includes(other.word)) distractors.push(other.word);
    if (distractors.length === count - 1) break;
  }
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
