"use client";

import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import { useOsTheme } from "@/lib/os-theme";
import { AuthStatus } from "@/components/AuthStatus";
import { BackendStatus } from "@/components/BackendStatus";
import { cn } from "@/lib/cn";
import { GameStatus } from "./GameStatus";

/** 미국 정복 5단계 티어 */
export const TIERS = [
  { id: "jfk", emoji: "✈️", name: "JFK 입국자" },
  { id: "manhattan", emoji: "🚇", name: "맨해튼 유학생" },
  { id: "columbia", emoji: "🏛️", name: "컬럼비아 연구원" },
  { id: "ivy", emoji: "🎓", name: "아이비리그 졸업생" },
] as const;

export type TierId = (typeof TIERS)[number]["id"];

/** 뉴욕 현지 시간. 서버와 클라이언트의 시각이 다를 수밖에 없으므로
 *  마운트 전에는 자리만 잡아 두고 하이드레이션 불일치를 피한다. */
function easternTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "America/New_York", weekday: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date());
}
function subscribeClock(update: () => void) {
  const timer = window.setInterval(update, 1000);
  return () => window.clearInterval(timer);
}
function useEasternTime() {
  return useSyncExternalStore(subscribeClock, easternTime, () => "—");
}

type MenuBarProps = { activeApp: string | null };

export function MenuBar({ activeApp }: MenuBarProps) {
  const { mode, toggle } = useOsTheme();
  const easternTime = useEasternTime();

  return (
    <header
      className="fixed inset-x-0 top-0 z-100 grid h-28 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px] backdrop-blur-2xl sm:flex sm:h-9 sm:py-0"
      style={{
        background: "var(--os-glass-strong)",
        borderBottom: "1px solid var(--os-border)",
        color: "var(--os-ink)",
      }}
    >
      {/* 좌측: 로고 + 활성 앱 메뉴 */}
      <span className="flex items-center gap-1.5 font-semibold tracking-tight">
        <span aria-hidden>🗽</span> TOEFL OS
      </span>

      {activeApp ? (
        <nav className="hidden items-center gap-4 xl:flex" style={{ color: "var(--os-ink-dim)" }}>
          <span className="font-medium" style={{ color: "var(--os-ink)" }}>
            {activeApp}
          </span>
        </nav>
      ) : null}

      <GameStatus />
      <div className="col-span-2 row-start-2 flex min-w-0 items-center justify-between gap-2 sm:order-1 sm:ml-auto sm:justify-end">
        <BackendStatus />
        <AuthStatus />

        <span
          className="hidden font-mono text-[12px] tabular-nums xl:inline"
          style={{ color: "var(--os-ink-dim)" }}
          suppressHydrationWarning
        >
          {easternTime} 뉴욕
        </span>

      </div>

        {/* 작은 화면에서는 첫째 줄, 연결·인증 상태는 둘째 줄에 둡니다. */}
        <button
          type="button"
          onClick={toggle}
          aria-label={`${mode === "study" ? "NYC Arcade" : "Study OS"} 모드로 전환`}
          className="relative ml-auto flex h-6 w-[136px] shrink-0 items-center rounded-full px-1 text-[11px] font-medium sm:order-2 sm:ml-0"
          style={{ background: "var(--os-glass)", border: "1px solid var(--os-border)" }}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn("absolute h-4.5 w-[64px] rounded-full", mode === "study" ? "left-1" : "left-[68px]")}
            style={{ background: "var(--os-accent)", opacity: 0.85 }}
          />
          <span
            className={cn("relative z-10 flex-1 text-center", mode === "study" && "text-black")}
          >
            📚 Study
          </span>
          <span
            className={cn("relative z-10 flex-1 text-center", mode === "arcade" && "text-black")}
          >
            🕹️ Arcade
          </span>
        </button>
    </header>
  );
}
