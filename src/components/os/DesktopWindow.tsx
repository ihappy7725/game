"use client";

import { useLayoutEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, useDragControls, useMotionValue } from "framer-motion";
import { cn } from "@/lib/cn";

type DesktopWindowProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  onMinimize: () => void;
  onFocus: () => void;
  zIndex: number;
  minimized: boolean;
  initial: { x: number; y: number };
  width?: number;
  boundsRef?: RefObject<HTMLElement | null>;
};

/** 최소화는 숨기기만 하고, 닫을 때만 학습 본문과 녹음기를 정리합니다. */
export function DesktopWindow({
  title, children, onClose, onMinimize, onFocus, zIndex, minimized,
  initial, width = 720, boundsRef,
}: DesktopWindowProps) {
  const [maximized, setMaximized] = useState(false);
  const titleId = useId();
  const elementRef = useRef<HTMLElement>(null);
  const restoredPosition = useRef(initial);
  const dragControls = useDragControls();
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);

  useLayoutEffect(() => {
    const clamp = () => {
      const bounds = boundsRef?.current;
      const element = elementRef.current;
      if (!bounds || !element || minimized) return;
      x.set(maximized ? 8 : Math.max(8, Math.min(x.get(), bounds.clientWidth - element.offsetWidth - 8)));
      y.set(maximized ? 8 : Math.max(8, Math.min(y.get(), bounds.clientHeight - element.offsetHeight - 8)));
    };
    clamp();
    const observer = new ResizeObserver(clamp);
    if (boundsRef?.current) observer.observe(boundsRef.current);
    if (elementRef.current) observer.observe(elementRef.current);
    return () => observer.disconnect();
  }, [boundsRef, maximized, minimized, x, y]);

  function toggleMaximize() {
    if (!maximized) {
      restoredPosition.current = { x: x.get(), y: y.get() };
      x.set(8);
      y.set(8);
    } else {
      x.set(restoredPosition.current.x);
      y.set(restoredPosition.current.y);
    }
    setMaximized(!maximized);
  }

  return (
    <motion.section
      ref={elementRef} role="region" aria-labelledby={titleId} aria-hidden={minimized} inert={minimized}
      drag={!maximized} dragListener={false} dragControls={dragControls}
      dragMomentum={false} dragConstraints={boundsRef} dragElastic={0}
      onPointerDown={onFocus} onFocusCapture={onFocus}
      style={{
        display: minimized ? "none" : "flex", zIndex, x, y, left: 0, top: 0,
        width: maximized ? "calc(100% - 16px)" : width, maxWidth: "calc(100% - 16px)",
        height: maximized ? "calc(100% - 16px)" : undefined, maxHeight: "calc(100% - 16px)",
        background: "var(--os-glass-strong)", border: "1px solid var(--os-border)",
        boxShadow: "var(--os-shadow)", color: "var(--os-ink)",
      }}
      className="absolute flex-col overflow-hidden rounded-[18px] backdrop-blur-2xl"
    >
      <header
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button")) return;
          if (!maximized) dragControls.start(event);
        }}
        onDoubleClick={(event) => {
          if (!(event.target as HTMLElement).closest("button")) toggleMaximize();
        }}
        className={cn("flex shrink-0 touch-none items-center gap-1 px-3 py-2 select-none", maximized ? "cursor-default" : "cursor-grab active:cursor-grabbing")}
        style={{ borderBottom: "1px solid var(--os-border)", background: "var(--os-glass)" }}
      >
        <TrafficLight color="#ff5f57" label="닫기" onClick={onClose} glyph="×" />
        <TrafficLight color="#febc2e" label="최소화" onClick={onMinimize} glyph="−" />
        <TrafficLight color="#28c840" label={maximized ? "이전 크기로" : "최대화"} onClick={toggleMaximize} glyph={maximized ? "⤡" : "⤢"} />
        <h2 id={titleId} className="ml-2 truncate text-sm font-medium">{title}</h2>
      </header>
      <div className="min-h-0 flex-1 overflow-auto overscroll-contain p-4 sm:p-6">{children}</div>
    </motion.section>
  );
}

function TrafficLight({ color, label, onClick, glyph }: {
  color: string; label: string; onClick: () => void; glyph: string;
}) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label}
      className="group grid h-6 w-6 shrink-0 place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-white">
      <span style={{ background: color }} className="grid h-3 w-3 place-items-center rounded-full text-[10px] leading-none text-black/70">
        <span aria-hidden className="opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100">{glyph}</span>
      </span>
    </button>
  );
}
