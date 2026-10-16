"use client";

import { useEffect, useReducer, useState } from "react";
import { gameError, tokenForGameUser } from "@/lib/game-state";

/** 계정별 화면 안에서만 사용합니다. 새 조회가 시작되면 이전 응답을 폐기합니다. */
export function useGameResource<T>(userId: string, fetcher: (token: string, signal: AbortSignal) => Promise<T>, refreshKey = 0) {
  const [revision, reload] = useReducer((n: number) => n + 1, 0);
  const key = `${revision}:${refreshKey}`;
  const [result, setResult] = useState<{ key: string; data?: T; error?: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const token = await tokenForGameUser(userId);
        if (!active) return;
        const data = await fetcher(token, controller.signal);
        if (active) setResult({ key, data });
      } catch (error) {
        if (active) setResult({ key, error: gameError(error) });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [userId, key, fetcher]);
  return { data: result?.data, error: result?.key === key ? result.error : undefined, loading: result?.key !== key, reload };
}
