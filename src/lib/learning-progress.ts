"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { useGameState } from "./game-state";
import { VOCAB } from "./vocab";

export type LearningGame = "cab" | "fork" | "pop" | "boss";
export type LearningRecord = { learned: string[]; stages: Partial<Record<LearningGame, number[]>> };
export const VOCAB_GOAL = 4000;
export const LEARNING_PREFIX = "toefl-learning-v1:";
const EVENT = "toefl-learning-change";
const EMPTY = '{"learned":[],"stages":{}}';
const fallback = new Map<string, string>();
const failed = new Set<string>();
const wordSet = new Set(VOCAB.map(item => item.word.toLowerCase()));
export const wordId = (word: string) => word.trim().toLowerCase();

export function parseLearning(raw: string): LearningRecord {
  try {
    const value = JSON.parse(raw);
    const learned = Array.isArray(value?.learned) ? [...new Set<string>(value.learned.filter((word: unknown) => typeof word === "string" && wordSet.has(word))) ] : [];
    const stages: LearningRecord["stages"] = {};
    for (const game of ["cab", "fork", "pop", "boss"] as const) {
      if (Array.isArray(value?.stages?.[game])) stages[game] = [0, 1, 2].map(i => Number.isInteger(value.stages[game][i]) ? Math.max(0, Math.min(100, value.stages[game][i])) : 0);
    }
    return { learned, stages };
  } catch { return { learned: [], stages: {} }; }
}
export function unlockedDifficulty(record: LearningRecord, game: LearningGame) {
  const stages = record.stages[game] ?? [];
  return stages[1] >= 2 ? 2 : stages[0] >= 1 ? 1 : 0;
}
function read(key: string | null) {
  if (!key) return EMPTY;
  try { return failed.has(key) ? fallback.get(key) ?? EMPTY : localStorage.getItem(key) ?? EMPTY; }
  catch { return fallback.get(key) ?? EMPTY; }
}
function subscribe(update: () => void) {
  window.addEventListener("storage", update); window.addEventListener(EVENT, update);
  return () => { window.removeEventListener("storage", update); window.removeEventListener(EVENT, update); };
}
function write(key: string, change: (record: LearningRecord) => LearningRecord) {
  const next = JSON.stringify(change(parseLearning(read(key))));
  fallback.set(key, next);
  try { localStorage.setItem(key, next); failed.delete(key); } catch { failed.add(key); }
  window.dispatchEvent(new Event(EVENT));
}
/** 계정별 브라우저 기록입니다. 비로그인 기록을 로그인 계정에 자동 합치지 않습니다. */
export function useLearningProgress() {
  const { auth } = useGameState();
  const owner = auth.status === "loading" ? null : auth.status === "signed-in" ? auth.userId : "guest";
  const key = owner ? LEARNING_PREFIX + owner : null;
  const raw = useSyncExternalStore(subscribe, () => read(key), () => EMPTY);
  const volatile = useSyncExternalStore(subscribe, () => Boolean(key && failed.has(key)), () => false);
  const record = useMemo(() => parseLearning(raw), [raw]);
  const learn = useCallback((words: string[]) => {
    if (!key) return;
    const valid = words.map(wordId).filter(word => wordSet.has(word));
    if (!valid.length) return;
    write(key, current => ({ ...current, learned: [...new Set([...current.learned, ...valid])] }));
  }, [key]);
  const clearStage = useCallback((game: LearningGame, difficulty: number, stage: number) => {
    if (!key || !Number.isInteger(difficulty) || difficulty < 0 || difficulty > 2 || stage < 1) return;
    write(key, current => {
      const best = [...(current.stages[game] ?? [0, 0, 0])]; best[difficulty] = Math.max(best[difficulty], stage);
      return { ...current, stages: { ...current.stages, [game]: best } };
    });
  }, [key]);
  return { owner, record, learn, clearStage, volatile, loading: !owner };
}
/** 도중에 계정이 바뀐 판을 새 계정의 학습/해제 기록으로 처리하지 않습니다. */
export function useGameLearning(game: LearningGame, difficulty: number) {
  const { owner, learn, clearStage } = useLearningProgress();
  const runOwner = useRef<string | null>(null);
  const begin = useCallback(() => { runOwner.current = owner; }, [owner]);
  const correct = useCallback((word: string) => { if (owner && runOwner.current === owner) learn([word]); }, [owner, learn]);
  const milestone = useCallback((stage: number) => { if (owner && runOwner.current === owner) clearStage(game, difficulty, stage); }, [owner, game, difficulty, clearStage]);
  return { begin, correct, milestone };
}
