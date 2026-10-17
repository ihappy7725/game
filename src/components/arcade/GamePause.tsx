"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode, type Dispatch, type SetStateAction } from "react";
import { Pause, Play } from "lucide-react";
import { gameLoopStatus, subscribeGameLoop, type ArcadeGame } from "@/lib/game-feedback";

const Context = createContext<{ paused: boolean; setPaused: Dispatch<SetStateAction<boolean>> } | null>(null);

/** 조작 버튼과 게임 시계가 같은 정지 상태를 사용합니다. 판/계정 변경 시 제공자를 다시 만듭니다. */
export function GamePauseProvider({ children }: { children: ReactNode }) {
  const [paused, setPaused] = useState(false);
  return <Context value={{ paused, setPaused }}>{children}</Context>;
}
export function useGamePause() {
  const state = useContext(Context);
  if (!state) throw new Error("게임 정지 상태를 찾을 수 없습니다.");
  return state;
}
export function GamePauseButton({ game }: { game: ArcadeGame }) {
  const { paused, setPaused } = useGamePause();
  const status = useSyncExternalStore(subscribeGameLoop, () => gameLoopStatus(game), () => "idle");
  const enabled = status === "running" || status === "paused";
  return <button className="game-pause-button" disabled={!enabled} aria-label={paused ? "계속하기" : "일시정지"} aria-pressed={paused} title={paused ? "계속하기" : "일시정지"} onClick={() => setPaused(value => !value)}>{paused ? <Play size={18}/> : <Pause size={18}/>}</button>;
}
