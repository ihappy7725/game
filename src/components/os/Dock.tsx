"use client";

import { useRef } from "react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { cn } from "@/lib/cn";

export type DockApp = {
  id: string;
  emoji: string;
  label: string;
  /** 네온 강조 (NYC Arcade 전용) */
  neon?: boolean;
};

export const DOCK_APPS: DockApp[] = [
  { id: "reading", emoji: "📖", label: "Reading & Listening" },
  { id: "writing", emoji: "✍️", label: "Writing AI" },
  { id: "speaking", emoji: "🎙️", label: "Speaking AI" },
  { id: "history", emoji: "📊", label: "History" },
  { id: "dorm", emoji: "🏠", label: "My NYC Dorm" },
  { id: "arcade", emoji: "🕹️", label: "NYC Arcade", neon: true },
];

const BASE_SIZE = 46;
const MAX_SIZE = 78;
/** 커서가 이 거리 안에 들어오면 아이콘이 커지기 시작 */
const INFLUENCE = 140;

function DockIcon({
  app,
  mouseX,
  isOpen,
  onOpen,
}: {
  app: DockApp;
  mouseX: MotionValue<number>;
  isOpen: boolean;
  onOpen: (id: string) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);

  // 커서와 아이콘 중심 사이의 수평 거리 → 크기
  const distance = useTransform(mouseX, (x) => {
    const bounds = ref.current?.getBoundingClientRect();
    if (!bounds) return INFLUENCE;
    return x - (bounds.left + bounds.width / 2);
  });

  const sizeTarget = useTransform(
    distance,
    [-INFLUENCE, 0, INFLUENCE],
    [BASE_SIZE, MAX_SIZE, BASE_SIZE],
  );
  const size = useSpring(sizeTarget, { stiffness: 320, damping: 24, mass: 0.4 });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onOpen(app.id)}
      aria-label={app.label}
      title={app.label}
      className="group relative flex shrink-0 items-end"
    >
      <motion.span
        style={{ width: size, height: size }}
        className={cn(
          "grid place-items-center rounded-[22%] text-[1.5rem] backdrop-blur-xl",
          app.neon && "shadow-[0_0_22px_-2px_var(--os-accent)]",
        )}
      >
        <span
          className="grid h-full w-full place-items-center rounded-[22%]"
          style={{
            background: app.neon ? "var(--os-accent)" : "var(--os-glass-strong)",
            border: `1px solid ${app.neon ? "transparent" : "var(--os-border)"}`,
          }}
        >
          <span aria-hidden className="text-[min(1.9rem,60%)] leading-none">
            {app.emoji}
          </span>
        </span>
      </motion.span>

      {/* 실행 중 표시 점 */}
      <span
        aria-hidden
        className={cn(
          "absolute -bottom-2 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full transition-opacity",
          isOpen ? "opacity-90" : "opacity-0",
        )}
        style={{ background: "var(--os-ink)" }}
      />

      {/* 호버 툴팁 */}
      <span
        className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 rounded-md px-2 py-1 text-[11px] whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100"
        style={{
          background: "var(--os-glass-strong)",
          border: "1px solid var(--os-border)",
          color: "var(--os-ink)",
        }}
      >
        {app.label}
      </span>
    </button>
  );
}

export function Dock({
  openApps,
  onOpen,
}: {
  openApps: string[];
  onOpen: (id: string) => void;
}) {
  const mouseX = useMotionValue(Number.POSITIVE_INFINITY);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-90 flex justify-center pb-3">
      <nav
        onMouseMove={(e) => mouseX.set(e.clientX)}
        onMouseLeave={() => mouseX.set(Number.POSITIVE_INFINITY)}
        aria-label="앱 독"
        className="pointer-events-auto flex items-end gap-2.5 rounded-2xl px-3 pt-2 pb-3 backdrop-blur-2xl"
        style={{
          background: "var(--os-dock)",
          border: "1px solid var(--os-border)",
          boxShadow: "var(--os-shadow)",
        }}
      >
        {DOCK_APPS.map((app, index) => (
          <div key={app.id} className="flex items-end gap-2.5">
            {/* Arcade 앞에 구분선 */}
            {index === DOCK_APPS.length - 1 ? (
              <span
                aria-hidden
                className="mb-2 h-10 w-px self-center"
                style={{ background: "var(--os-border)" }}
              />
            ) : null}
            <DockIcon
              app={app}
              mouseX={mouseX}
              isOpen={openApps.includes(app.id)}
              onOpen={onOpen}
            />
          </div>
        ))}
      </nav>
    </div>
  );
}
