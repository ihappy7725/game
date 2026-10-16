/** Yellow Cab Rush 용 토플 어휘 데이터.
 *
 *  출제는 정적 데이터로 진행하고 종료 후 보상·오답을 게임 API로 보냅니다.
 *
 *  decoys 는 "그럴듯하지만 분명히 다른 뜻"으로 골랐습니다. 반의어나 같은 주제의
 *  다른 단어를 섞어야 찍기가 아니라 뜻을 알아야 풀립니다.
 */

export type VocabItem = {
  word: string;
  /** 정답 동의어 */
  synonym: string;
  /** 오답 후보 2개 */
  decoys: [string, string];
  /** 라운드가 끝난 뒤 보여 주는 한국어 뜻 */
  meaning: string;
};

export const VOCAB: VocabItem[] = [
  { word: "abundant", synonym: "plentiful", decoys: ["scarce", "hostile"], meaning: "풍부한" },
  { word: "arbitrary", synonym: "random", decoys: ["deliberate", "precise"], meaning: "임의적인" },
  { word: "coherent", synonym: "logical", decoys: ["chaotic", "hollow"], meaning: "일관성 있는" },
  { word: "deteriorate", synonym: "worsen", decoys: ["flourish", "assemble"], meaning: "악화되다" },
  { word: "diminish", synonym: "decrease", decoys: ["amplify", "sustain"], meaning: "줄어들다" },
  { word: "elaborate", synonym: "detailed", decoys: ["brief", "vacant"], meaning: "정교한" },
  { word: "feasible", synonym: "achievable", decoys: ["impossible", "reckless"], meaning: "실현 가능한" },
  { word: "hostile", synonym: "unfriendly", decoys: ["gracious", "fertile"], meaning: "적대적인" },
  { word: "inevitable", synonym: "unavoidable", decoys: ["optional", "gradual"], meaning: "불가피한" },
  { word: "intricate", synonym: "complex", decoys: ["simple", "barren"], meaning: "복잡한" },
  { word: "lucrative", synonym: "profitable", decoys: ["worthless", "tedious"], meaning: "수익성 있는" },
  { word: "meticulous", synonym: "careful", decoys: ["careless", "abrupt"], meaning: "꼼꼼한" },
  { word: "mitigate", synonym: "alleviate", decoys: ["aggravate", "provoke"], meaning: "완화하다" },
  { word: "notion", synonym: "concept", decoys: ["evidence", "barrier"], meaning: "개념" },
  { word: "obsolete", synonym: "outdated", decoys: ["modern", "durable"], meaning: "구식의" },
  { word: "plausible", synonym: "believable", decoys: ["absurd", "rigid"], meaning: "그럴듯한" },
  { word: "prominent", synonym: "notable", decoys: ["obscure", "trivial"], meaning: "두드러진" },
  { word: "refute", synonym: "disprove", decoys: ["confirm", "endorse"], meaning: "반박하다" },
  { word: "scarce", synonym: "rare", decoys: ["abundant", "dense"], meaning: "부족한" },
  { word: "subtle", synonym: "understated", decoys: ["obvious", "harsh"], meaning: "미묘한" },
  { word: "tedious", synonym: "boring", decoys: ["thrilling", "concise"], meaning: "지루한" },
  { word: "vulnerable", synonym: "susceptible", decoys: ["immune", "sturdy"], meaning: "취약한" },
  { word: "ambiguous", synonym: "unclear", decoys: ["definite", "candid"], meaning: "모호한" },
  { word: "compile", synonym: "gather", decoys: ["scatter", "discard"], meaning: "모아 엮다" },
  { word: "constrain", synonym: "restrict", decoys: ["liberate", "expand"], meaning: "제한하다" },
  { word: "derive", synonym: "obtain", decoys: ["donate", "forfeit"], meaning: "끌어내다" },
  { word: "endure", synonym: "withstand", decoys: ["surrender", "vanish"], meaning: "견디다" },
  { word: "exploit", synonym: "utilize", decoys: ["neglect", "conceal"], meaning: "활용하다" },
  { word: "imperative", synonym: "essential", decoys: ["optional", "lenient"], meaning: "필수적인" },
  { word: "sustain", synonym: "maintain", decoys: ["abandon", "disrupt"], meaning: "유지하다" },
];

/** 매 판마다 겹치지 않게 섞은 출제 순서를 만든다. */
export function shuffledDeck(): VocabItem[] {
  const deck = [...VOCAB];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
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
