"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type GlassWindowProps = {
  /** 타이틀바에 표시할 창 제목 */
  title: string;
  /** 타이틀바 우측 영역 (상태 표시 등) */
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  /** 스태거 애니메이션에서의 등장 순서 */
  delay?: number;
};

/** macOS 창을 닮은 유리 패널. 앱의 모든 섹션이 이 창 안에 들어갑니다. */
export function GlassWindow({
  title,
  toolbar,
  children,
  className,
  delay = 0,
}: GlassWindowProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 240, damping: 26, delay }}
      className={cn(
        "glass glass-sheen overflow-hidden rounded-[var(--radius-window)]",
        className,
      )}
    >
      {/* 타이틀바: 신호등 버튼 3개 + 제목 */}
      <header className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <span aria-hidden className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span aria-hidden className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span aria-hidden className="h-3 w-3 rounded-full bg-[#28c840]" />
        <h2 className="ml-3 text-sm font-medium tracking-tight text-white/70">
          {title}
        </h2>
        {toolbar ? <div className="ml-auto">{toolbar}</div> : null}
      </header>

      <div className="p-6 sm:p-8">{children}</div>
    </motion.section>
  );
}
