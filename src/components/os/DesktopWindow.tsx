"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { motion, useDragControls } from "framer-motion";
import { cn } from "@/lib/cn";

type DesktopWindowProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  /** 이 창을 맨 앞으로 */
  onFocus: () => void;
  zIndex: number;
  /** 처음 놓일 자리 (CSS left/top). 드래그 이동은 transform이 담당한다. */
  initial: { x: number; y: number };
  width?: number;
  /** 드래그 범위를 제한할 바탕화면 영역 */
  boundsRef?: RefObject<HTMLElement | null>;
  toolbar?: ReactNode;
};

/** macOS 창. 타이틀바를 잡고 끌 수 있고, 신호등 버튼으로 닫기·최소화·최대화한다.
 *
 *  두 가지를 의도적으로 분리했다.
 *   - 위치: left/top(처음 자리) + transform(드래그 이동). animate로 x/y를
 *     건드리면 드래그 중 값이 되돌아가므로 서로 침범하지 않게 둔다.
 *   - 드래그 시작: dragListener={false} + useDragControls 로 타이틀바에서만
 *     시작시킨다. 본문 텍스트를 드래그해도 창이 끌려가지 않는다.
 */
export function DesktopWindow({
  title,
  children,
  onClose,
  onMinimize,
  onFocus,
  zIndex,
  initial,
  width = 720,
  boundsRef,
  toolbar,
}: DesktopWindowProps) {
  const [maximized, setMaximized] = useState(false);
  const dragControls = useDragControls();

  return (
    <motion.section
      drag={!maximized}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragConstraints={boundsRef}
      dragElastic={0.03}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      onPointerDown={onFocus}
      style={{
        zIndex,
        left: maximized ? 16 : initial.x,
        top: maximized ? 8 : initial.y,
        width: maximized ? "calc(100% - 32px)" : width,
        maxWidth: "calc(100vw - 32px)",
        background: "var(--os-glass-strong)",
        border: "1px solid var(--os-border)",
        boxShadow: "var(--os-shadow)",
        color: "var(--os-ink)",
      }}
      className="absolute overflow-hidden rounded-[18px] backdrop-blur-2xl"
    >
      <header
        onPointerDown={(event) => {
          // 신호등 버튼을 눌렀을 때는 드래그가 시작되지 않게 한다.
          if ((event.target as HTMLElement).closest("button")) return;
          if (!maximized) dragControls.start(event);
        }}
        className={cn(
          "flex items-center gap-2 px-4 py-3 select-none",
          maximized ? "cursor-default" : "cursor-grab active:cursor-grabbing",
        )}
        style={{ borderBottom: "1px solid var(--os-border)", background: "var(--os-glass)" }}
      >
        <TrafficLight color="#ff5f57" label="닫기" onClick={onClose} glyph="×" />
        <TrafficLight color="#febc2e" label="최소화" onClick={onMinimize} glyph="−" />
        <TrafficLight
          color="#28c840"
          label={maximized ? "이전 크기로" : "최대화"}
          onClick={() => setMaximized((v) => !v)}
          glyph={maximized ? "⤡" : "⤢"}
        />

        <h2
          className="ml-3 text-sm font-medium tracking-tight"
          style={{ color: "var(--os-ink-dim)" }}
        >
          {title}
        </h2>

        {toolbar ? <div className="ml-auto">{toolbar}</div> : null}
      </header>

      <div
        className={cn(
          "overflow-y-auto p-6",
          maximized ? "max-h-[calc(100dvh-120px)]" : "max-h-[62dvh]",
        )}
      >
        {children}
      </div>
    </motion.section>
  );
}

function TrafficLight({
  color,
  label,
  onClick,
  glyph,
}: {
  color: string;
  label: string;
  onClick: () => void;
  glyph: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="group grid h-3 w-3 place-items-center rounded-full text-[8px] leading-none text-black/55"
      style={{ background: color }}
    >
      <span aria-hidden className="opacity-0 transition-opacity group-hover:opacity-100">
        {glyph}
      </span>
    </button>
  );
}
