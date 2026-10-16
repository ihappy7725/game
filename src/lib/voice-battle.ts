/** 문장 일치도는 인식된 단어의 순서·누락·추가를 비교합니다. */
export const VOICE_CHALLENGES = [
  { text: "Regular practice helps students speak with confidence.", meaning: "꾸준한 연습은 학생들이 자신 있게 말하도록 돕습니다." },
  { text: "Public libraries provide valuable resources for the community.", meaning: "공공 도서관은 지역사회에 유용한 자원을 제공합니다." },
  { text: "Working in a team encourages creative problem solving.", meaning: "팀 활동은 창의적인 문제 해결을 장려합니다." },
  { text: "Reliable evidence is essential for a convincing argument.", meaning: "설득력 있는 주장에는 신뢰할 수 있는 근거가 필수입니다." },
  { text: "Learning a new language requires patience and persistence.", meaning: "새로운 언어를 배우려면 인내와 끈기가 필요합니다." },
] as const;

function words(text: string): string[] {
  return text.slice(0, 1000).normalize("NFKC").toLowerCase().replace(/[’‘]/g, "'").match(/[a-z]+(?:'[a-z]+)?|\d+/g) ?? [];
}

export function compareSpokenWords(target: string, spoken: string) {
  const expected = words(target);
  const actual = words(spoken);
  const distances = Array.from({ length: expected.length + 1 }, (_, i) => Array.from({ length: actual.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= expected.length; i++) {
    for (let j = 1; j <= actual.length; j++) {
      distances[i][j] = Math.min(distances[i - 1][j] + 1, distances[i][j - 1] + 1, distances[i - 1][j - 1] + (expected[i - 1] === actual[j - 1] ? 0 : 1));
    }
  }
  let i = expected.length;
  let j = actual.length;
  const matches = expected.map((word) => ({ word, matched: false }));
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === actual[j - 1] && distances[i][j] === distances[i - 1][j - 1]) {
      matches[i - 1].matched = true;
      i--; j--;
    } else if (i > 0 && j > 0 && distances[i][j] === distances[i - 1][j - 1] + 1) { i--; j--; }
    else if (i > 0 && distances[i][j] === distances[i - 1][j] + 1) i--;
    else j--;
  }
  const edits = distances[expected.length][actual.length];
  const percent = expected.length === 0 || actual.length === 0 ? 0 : Math.max(0, Math.round((1 - edits / Math.max(expected.length, actual.length)) * 100));
  return { percent, edits, matches };
}
