"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribe = (update: () => void) => { document.addEventListener("fullscreenchange", update); return () => document.removeEventListener("fullscreenchange", update); };
/** 첫 클릭에서만 자동 진입합니다. Esc 해제 뒤에는 버튼으로 다시 진입합니다. */
export function useBrowserFullscreen(onExit: () => void) {
  const active = useSyncExternalStore(subscribe, () => Boolean(document.fullscreenElement), () => false);
  const supported = useSyncExternalStore(subscribe, () => Boolean(document.fullscreenEnabled), () => false);
  const [message, setMessage] = useState("");
  const attempted = useRef(false);
  const exitHandler = useRef(onExit);
  useEffect(() => { exitHandler.current = onExit; }, [onExit]);
  const enter = useCallback(() => {
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    void document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => setMessage("")).catch(() => setMessage("전체화면 버튼을 눌러 다시 시도해 주세요."));
  }, []);
  useEffect(() => {
    let wasFullscreen = Boolean(document.fullscreenElement);
    const change = () => {
      const next = Boolean(document.fullscreenElement);
      if (wasFullscreen && !next) exitHandler.current();
      wasFullscreen = next;
    };
    const firstClick = (event: MouseEvent) => {
      if (attempted.current) return;
      attempted.current = true;
      if (!(event.target instanceof Element) || !event.target.closest("[data-fullscreen-control],a")) enter();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
    document.addEventListener("click", firstClick, true); document.addEventListener("fullscreenchange", change); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", firstClick, true); document.removeEventListener("fullscreenchange", change); document.removeEventListener("keydown", escape); };
  }, [enter]);
  const toggle = () => {
    attempted.current = true;
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => setMessage("Esc로 전체화면을 해제해 주세요."));
    else enter();
  };
  return { active, supported, message, toggle };
}
