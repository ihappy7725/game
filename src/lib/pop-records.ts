export type PopRecord = { stage: number; difficulty: number; elapsedMs: number; score: number; at: number };
export const POP_RECORD_KEY = "toefl-pop-times-v1";
export const popStageTarget = (stage: number, difficulty: number) => 1200 + (stage - 1) * 800 + difficulty * 400;
export const formatPopTime = (ms: number) => `${(ms / 1000).toFixed(2)}초`;

/** 브라우저에 보관한 연습 기록만 정렬합니다. 서버 공식 순위가 아닙니다. */
export function parsePopRecords(raw: string | null): PopRecord[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((r): r is PopRecord => Boolean(r && typeof r === "object" &&
      Number.isInteger(r.stage) && r.stage >= 1 && r.stage <= 5 &&
      Number.isInteger(r.difficulty) && r.difficulty >= 0 && r.difficulty <= 2 &&
      Number.isFinite(r.elapsedMs) && r.elapsedMs > 0 && r.elapsedMs <= 60_000 &&
      Number.isFinite(r.score) && r.score >= popStageTarget(r.stage, r.difficulty) && Number.isFinite(r.at)));
  } catch { return []; }
}
export function rankPopRecords(records: PopRecord[], stage: number, difficulty: number) {
  return records.filter(r => r.stage === stage && r.difficulty === difficulty).sort((a, b) => a.elapsedMs - b.elapsedMs || a.at - b.at).slice(0, 10);
}
