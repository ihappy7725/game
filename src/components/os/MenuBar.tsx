"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useOsTheme } from "@/lib/os-theme";
import { cn } from "@/lib/cn";

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
function useEasternTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date());

    setTime(format());
    const timer = window.setInterval(() => setTime(format()), 15_000);
    return () => window.clearInterval(timer);
  }, []);

  return time;
}

type MenuBarProps = {
  tier: TierId;
  coins: number;
  activeApp: string | null;
};

export function MenuBar({ tier, coins, activeApp }: MenuBarProps) {
  const { mode, toggle } = useOsTheme();
  const easternTime = useEasternTime();
  const currentTier = TIERS.find((t) => t.id === tier) ?? TIERS[0];

  return (
    <header
      className="fixed inset-x-0 top-0 z-100 flex h-9 items-center gap-4 px-3 text-[13px] backdrop-blur-2xl"
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
        <nav className="hidden items-center gap-4 sm:flex" style={{ color: "var(--os-ink-dim)" }}>
          <span className="font-medium" style={{ color: "var(--os-ink)" }}>
            {activeApp}
          </span>
          <span>파일</span>
          <span>편집</span>
          <span>보기</span>
        </nav>
      ) : null}

      {/* 우측: 티어 · 코인 · 뉴욕 시간 · 모드 전환 */}
      <div className="ml-auto flex items-center gap-3">
        <span
          className="hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium sm:flex"
          style={{ background: "var(--os-glass)", border: "1px solid var(--os-border)" }}
          title={`현재 티어: ${currentTier.name}`}
        >
          <span aria-hidden>{currentTier.emoji}</span>
          {currentTier.name}
        </span>

        <span className="flex items-center gap-1 font-mono text-[12px] tabular-nums">
          <span aria-hidden>💵</span>${coins.toLocaleString("en-US")}
        </span>

        <span
          className="hidden font-mono text-[12px] tabular-nums md:inline"
          style={{ color: "var(--os-ink-dim)" }}
          suppressHydrationWarning
        >
          {easternTime ?? "—"} EST
        </span>

        {/* 모드 전환 스위치 */}
        <button
          type="button"
          onClick={toggle}
          aria-label={`${mode === "study" ? "NYC Arcade" : "Study OS"} 모드로 전환`}
          className="relative flex h-6 w-[136px] items-center rounded-full px-1 text-[11px] font-medium"
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
      </div>
    </header>
  );
}
