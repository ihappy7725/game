import vocabulary from "@/data/vocabulary.json";

/** Yellow Cab Rush 용 토플 어휘 데이터.
 *
 *  출제는 정적 데이터로 진행하고 종료 후 보상·오답을 게임 API로 보냅니다.
 *
 *  decoys 는 "그럴듯하지만 분명히 다른 뜻"으로 골랐습니다. 반의어나 같은 주제의
 *  다른 단어를 섞어야 찍기가 아니라 뜻을 알아야 풀립니다.
 */

export type VocabItem = {
  word: string;
  /** 직접 작성하거나 가져온 학습 예문 */
  example: string;
  /** 정답 동의어 */
  synonym: string;
  /** 오답 후보 2개 */
  decoys: [string, string];
  /** 라운드가 끝난 뒤 보여 주는 한국어 뜻 */
  meaning: string;
};

export const VOCAB = vocabulary as VocabItem[];

/** 매 판마다 겹치지 않게 섞은 출제 순서를 만든다. */
export function shuffled<T>(items: readonly T[]): T[] {
  const deck = [...items];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}
export function shuffledDeck(reserve = 10): VocabItem[] {
  const deck = shuffled(VOCAB);
  // 최근 출제 대기열을 뒤로 보내 재시작·게임 전환 때 같은 초반 단어를 줄입니다.
  if (typeof window === "undefined") return deck;
  let recent: string[] = [];
  try { const raw = JSON.parse(sessionStorage.getItem("toefl-recent-vocab-v1") ?? "[]"); if (Array.isArray(raw)) recent = raw.filter(v => typeof v === "string").slice(-60); } catch { /* 저장이 막혀도 무작위 출제합니다. */ }
  const ordered = [...deck.filter(item => !recent.includes(item.word)), ...deck.filter(item => recent.includes(item.word))];
  try { sessionStorage.setItem("toefl-recent-vocab-v1", JSON.stringify([...recent, ...ordered.slice(0, reserve).map(item => item.word)].slice(-60))); } catch { /* 현재 판은 정상 진행합니다. */ }
  return ordered;
}

/** 한 라운드의 3개 차선. 정답이 어느 차선인지 함께 돌려준다. */
export function buildLanes(item: VocabItem): { lanes: string[]; correctLane: number } {
  const lanes = [item.synonym, ...item.decoys];
  for (let i = lanes.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [lanes[i], lanes[j]] = [lanes[j], lanes[i]];
  }
  return { lanes, correctLane: lanes.indexOf(item.synonym) };
}
