"use client";

import { useCallback, useState } from "react";
import { useGameState } from "./game-state";

export type RankedAttempt = { runId: string; userId: string | null; startedAt: number };
/** 시작한 계정을 고정하며, 중간에 로그인한 이전 연습 판을 소급 저장하지 않습니다. */
export function useRankedAttempt() {
  const { auth } = useGameState();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const [attempt, setAttempt] = useState<RankedAttempt | null>(null);
  const begin = useCallback(() => {
    setAttempt({ runId: crypto.randomUUID(), userId, startedAt: Date.now() });
  }, [userId]);
  return { attempt, begin };
}
