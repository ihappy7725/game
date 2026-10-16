"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import { ApiError, fetchGameState, type GameState } from "@/lib/api";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { useAuth, type AuthState } from "@/lib/useAuth";

type Snapshot = { userId: string; data?: GameState; error?: string };
type GameContextValue = {
  auth: AuthState;
  snapshot: Snapshot | null;
  refresh: () => void;
};
const GameContext = createContext<GameContextValue | null>(null);

export function gameError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    if (error.status === 404) return "실행 중인 백엔드에 게임 API가 없습니다. 최신 main.py로 백엔드를 다시 실행해 주세요.";
    if (error.status === 503) return "게임 서버 설정을 확인해 주세요.";
    return error.message;
  }
  return "게임 서버에 연결할 수 없습니다.";
}

/** 요청 직전에 세션의 계정까지 확인하여 다른 계정으로 이전 판을 저장하지 않습니다. */
export async function tokenForGameUser(userId: string): Promise<string> {
  const client = tryGetSupabaseBrowserClient();
  const session = client ? (await client.auth.getSession()).data.session : null;
  if (!session || session.user.id !== userId) throw new ApiError("로그인 계정이 바뀌었습니다. 새 판을 시작해 주세요.", 401);
  return session.access_token;
}

export function GameStateProvider({ children }: { children: ReactNode }) {
  const { state: auth } = useAuth();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revision, update] = useReducer((n: number) => n + 1, 0);
  const refresh = useCallback(() => update(), []);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    let active = true;
    void (async () => {
      try {
        const token = await tokenForGameUser(userId);
        if (!active) return;
        const data = await fetchGameState(token, controller.signal);
        if (active) setSnapshot({ userId, data });
      } catch (error) {
        if (active) setSnapshot({ userId, error: gameError(error) });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [userId, revision]);

  // 인증 변경 직후에도 이전 계정의 잔액을 표시하지 않습니다.
  const current = userId && snapshot?.userId === userId ? snapshot : null;
  return <GameContext.Provider value={{ auth, snapshot: current, refresh }}>{children}</GameContext.Provider>;
}

export function useGameState() {
  const value = useContext(GameContext);
  if (!value) throw new Error("게임 정보는 GameStateProvider 안에서 사용해 주세요.");
  return value;
}
