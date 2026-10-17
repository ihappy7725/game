"use client";

import { useRef, useState } from "react";
import { ApiError, saveRankedRecord, type RankedGame } from "@/lib/api";
import { gameError, tokenForGameUser, useGameState } from "@/lib/game-state";
import type { RankedAttempt } from "@/lib/useRankedAttempt";

export function RankedRecordSave({ attempt, game, difficulty, stage = 0, score, elapsedMs }: {
  attempt: RankedAttempt | null; game: RankedGame; difficulty: number; stage?: number; score: number; elapsedMs: number;
}) {
  const { auth } = useGameState();
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState(""); const locked = useRef(false);
  const allowed = attempt?.userId && auth.status === "signed-in" && auth.userId === attempt.userId;
  async function save() {
    if (!allowed || !attempt?.userId || locked.current) return;
    locked.current = true; setStatus("saving"); setMessage("");
    try {
      const token = await tokenForGameUser(attempt.userId);
      await saveRankedRecord(token, { run_id: attempt.runId, game_id: game, difficulty, stage, score, elapsed_ms: Math.max(1, Math.min(86_400_000, Math.round(elapsedMs))) });
      setStatus("saved"); setMessage("게임 기록을 저장했어요. 주간 게임 순위에서 확인하세요.");
      window.dispatchEvent(new Event("toefl-records-refresh"));
    } catch (error) {
      setStatus("error"); locked.current = false;
      setMessage(error instanceof ApiError && error.status === 503 ? "게임 기록 서버가 아직 준비되지 않았어요. 현재 판과 브라우저 기록은 유지됩니다." : error instanceof ApiError && error.status === 404 ? "게임 기록 기능을 연결한 뒤 저장할 수 있어요. 현재 판은 유지됩니다." : gameError(error));
    }
  }
  return <section className="ranked-save" aria-label="주간 게임 기록 저장">
    <p>주간 게임 순위 · 연습 기록</p>
    {allowed ? <button disabled={status === "saving" || status === "saved"} onClick={() => void save()}>{status === "saving" ? "게임 기록 저장 중…" : status === "saved" ? "게임 기록 저장 완료" : status === "error" ? "같은 게임 기록 다시 저장" : "주간 게임 기록 저장"}</button> : <small>{attempt?.userId ? "시작한 계정으로 로그인해야 이 판을 저장할 수 있어요." : "로그인 후 시작한 판부터 순위에 저장할 수 있어요."}</small>}
    {message ? <p role="status">{message}</p> : null}
    <small>코인과 별도 · 메모리 복습 제외</small>
  </section>;
}
