import type { ReactNode } from "react";

/** 네 게임이 같은 화면 좌표·크기의 캡슐 안에서 상태를 보여 줍니다. */
export function GameHud({ label, className = "", children }: { label: string; className?: string; children: ReactNode }) {
  return <aside data-game-hud role="group" aria-label={label} className={`arcade-stats ${className}`}>{children}</aside>;
}
