"use client";

import { createContext, useContext, useEffect, useReducer, useState, type ReactNode } from "react";
import { fetchInventory, fetchWeeklyLeaderboard, type InventoryItem, type WeeklyLeaderboard } from "./api";
import { gameError, tokenForGameUser, useGameState } from "./game-state";

export function deriveProgression(items: InventoryItem[], rank: number | null) {
  const weights: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 5 };
  const points = items.filter(item => item.placed && item.quantity > 0).reduce((sum, item) => sum + (weights[item.rarity] ?? 1), 0);
  const level = points >= 8 || (rank !== null && rank <= 5) ? 2 : points >= 3 || (rank !== null && rank <= 20) ? 1 : 0;
  return { points, level, title: ["첫걸음", "도전자", "마스터"][level] };
}
type Data = { items: InventoryItem[]; ranking: WeeklyLeaderboard };
type Value = { data?: Data; error?: string; loading: boolean; level: number; points: number; title: string; refresh: () => void };
const Context = createContext<Value | null>(null);
export const PROGRESSION_EVENT = "toefl-progress-refresh";
export function ProgressionProvider({ children }: { children: ReactNode }) {
  const { auth } = useGameState();
  const userId = auth.status === "signed-in" ? auth.userId : null;
  const [revision, refresh] = useReducer((n: number) => n + 1, 0);
  const [snapshot, setSnapshot] = useState<{ userId: string; revision: number; data?: Data; error?: string } | null>(null);
  useEffect(() => { window.addEventListener(PROGRESSION_EVENT, refresh); return () => window.removeEventListener(PROGRESSION_EVENT, refresh); }, []);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController(); let active = true;
    void (async () => {
      try {
        const token = await tokenForGameUser(userId);
        if (!active) return;
        const [inventory, ranking] = await Promise.all([fetchInventory(token, controller.signal), fetchWeeklyLeaderboard(token, controller.signal)]);
        if (active) setSnapshot({ userId, revision, data: { items: inventory.items, ranking } });
      } catch (error) { if (active) setSnapshot({ userId, revision, error: gameError(error) }); }
    })();
    return () => { active = false; controller.abort(); };
  }, [userId, revision]);
  const current = snapshot?.userId === userId && snapshot?.revision === revision ? snapshot : null;
  const progress = deriveProgression(current?.data?.items ?? [], current?.data?.ranking.my_rank ?? null);
  return <Context.Provider value={{ ...progress, data: current?.data, error: current?.error, loading: Boolean(userId && !current), refresh }}>{children}</Context.Provider>;
}
export function useProgression() { const value = useContext(Context); if (!value) throw new Error("성장 정보 제공자 안에서 사용하세요."); return value; }
