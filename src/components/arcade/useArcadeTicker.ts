"use client";

import { useEffect, useRef } from "react";

/** 화면을 숨기면 정지하고, 재개할 때 숨겨진 시간은 더하지 않습니다. */
export function useArcadeTicker(active: boolean, paused: boolean, tick: (delta: number, now: number) => void, pause: () => void) {
  const handlers = useRef({ tick, pause });
  useEffect(() => { handlers.current = { tick, pause }; }, [tick, pause]);
  useEffect(() => {
    const hide = () => { if (document.hidden) handlers.current.pause(); };
    document.addEventListener("visibilitychange", hide);
    return () => document.removeEventListener("visibilitychange", hide);
  }, []);
  useEffect(() => {
    if (!active || paused) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      if (!document.hidden) handlers.current.tick(now - last, now);
      last = now;
    }, 30);
    return () => window.clearInterval(timer);
  }, [active, paused]);
}
