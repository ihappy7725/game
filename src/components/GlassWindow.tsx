"use client";

import { motion } from "framer-motion";
import { createContext, useContext, type ReactNode } from "react";
import { cn } from "@/lib/cn";

const EmbeddedContext = createContext(false);

export function EmbeddedPanels({ children }: { children: ReactNode }) {
  return <EmbeddedContext.Provider value={true}>{children}</EmbeddedContext.Provider>;
}

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

/** 학습 내용과 도구를 담는 패널입니다. */
export function GlassWindow({
  title,
  toolbar,
  children,
  className,
  delay = 0,
}: GlassWindowProps) {
  const embedded = useContext(EmbeddedContext);
  if (embedded) {
    return (
      <section className={cn("space-y-4", className)}>
        <h3 className="border-b border-white/10 pb-3 text-sm font-medium text-white/70">{title}</h3>
        {children}
      </section>
    );
  }
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
      {/* 학습 영역 제목과 도구 */}
      <header className="flex items-center gap-2 border-b border-white/10 bg-white/5 px-4 py-3">
        <h2 className="text-sm font-medium tracking-tight text-white/70">
          {title}
        </h2>
        {toolbar ? <div className="ml-auto">{toolbar}</div> : null}
      </header>

      <div className="p-6 sm:p-8">{children}</div>
    </motion.section>
  );
}
