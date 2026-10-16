"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ArcadeGame = "cab" | "fork" | "pop" | "cards";
export type GameCue = "correct" | "miss" | "celebrate" | "sad" | "jump" | "pop";
export const CUE_EVENT = "toefl-game-cue";
export const LOOP_EVENT = "toefl-game-loop";
const loops: Partial<Record<ArcadeGame, string>> = {};
export function gameLoopStatus(game: ArcadeGame | null) { return game ? loops[game] ?? "idle" : "idle"; }
export function subscribeGameLoop(update: () => void) { window.addEventListener(LOOP_EVENT, update); return () => window.removeEventListener(LOOP_EVENT, update); }
export function gameCue(cue: GameCue) { window.dispatchEvent(new CustomEvent(CUE_EVENT, { detail: cue })); }
export function useGameLoop(game: ArcadeGame, status: "idle" | "running" | "paused" | "ended") {
  useEffect(() => {
    loops[game] = status;
    window.dispatchEvent(new CustomEvent(LOOP_EVENT, { detail: { game, status } }));
    return () => { loops[game] = "idle"; window.dispatchEvent(new CustomEvent(LOOP_EVENT, { detail: { game, status: "idle" } })); };
  }, [game, status]);
}
export type GameOutcome = { celebration: boolean; record: boolean; best: number; score: number };
/** 브라우저별 연습 기록입니다. 첫 판의 낮은 점수를 신기록으로 축하하지 않습니다. */
export function useGameOutcome(game: ArcadeGame, difficulty = 0) {
  const [outcome, setOutcome] = useState<GameOutcome | null>(null);
  const finished = useRef(false);
  const complete = useCallback((score: number, good: boolean) => {
    if (finished.current) return;
    finished.current = true;
    let previous: number | null = null;
    const key = `toefl-best-v1:${game}:${difficulty}`;
    try { const value = localStorage.getItem(key); const parsed = Number(value); if (value !== null && Number.isFinite(parsed) && parsed >= 0) previous = parsed; } catch { /* 저장 공간 없이도 결과를 표시합니다. */ }
    const best = Math.max(previous ?? 0, score);
    const record = previous !== null && score > previous;
    try { localStorage.setItem(key, String(best)); } catch { /* 이번 판 결과는 유지합니다. */ }
    const celebration = good || record;
    setOutcome({ score, best, record, celebration });
    gameCue(celebration ? "celebrate" : "sad");
  }, [game, difficulty]);
  const reset = useCallback(() => { finished.current = false; setOutcome(null); }, []);
  return { outcome, complete, reset };
}
