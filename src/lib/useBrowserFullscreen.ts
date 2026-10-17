"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

declare global { interface Window { toeflDesktop?: { fullscreen: boolean; setFullscreen: (active: boolean) => Promise<void> } } }
const subscribe = (update: () => void) => { document.addEventListener("fullscreenchange", update); window.addEventListener("toefl-desktop-fullscreen", update); return () => { document.removeEventListener("fullscreenchange", update); window.removeEventListener("toefl-desktop-fullscreen", update); }; };
const isFullscreen = () => Boolean(document.fullscreenElement || window.toeflDesktop?.fullscreen);
/** 로드 시 자동 진입을 시도하고 정책상 차단되면 첫 클릭에서 재시도합니다. Esc 뒤 자동 재진입하지 않습니다. */
export function useBrowserFullscreen(onExit: () => void) {
  const active = useSyncExternalStore(subscribe, isFullscreen, () => false);
  const supported = useSyncExternalStore(subscribe, () => Boolean(document.fullscreenEnabled || window.toeflDesktop), () => false);
  const [message, setMessage] = useState("");
  const attempted = useRef(false);
  const exitHandler = useRef(onExit);
  useEffect(() => { exitHandler.current = onExit; }, [onExit]);
  const enter = useCallback(() => {
    if (window.toeflDesktop) { attempted.current=true; if (!window.toeflDesktop.fullscreen) void window.toeflDesktop.setFullscreen(true).catch(() => setMessage("전용 창의 전체화면을 시작하지 못했습니다.")); return; }
    if (!document.fullscreenEnabled || document.fullscreenElement) return;
    void document.documentElement.requestFullscreen({ navigationUI: "hide" }).then(() => {attempted.current=true;setMessage("");}).catch(() => setMessage("전체화면 버튼을 눌러 다시 시도해 주세요."));
  }, []);
  useEffect(() => { enter(); },[enter]);
  useEffect(() => {
    let wasFullscreen = isFullscreen();
    const change = () => {
      const next = isFullscreen();
      if (wasFullscreen && !next) exitHandler.current();
      wasFullscreen = next;
    };
    const firstClick = (event: MouseEvent) => {
      if (attempted.current) return;
      attempted.current = true;
      if (!(event.target instanceof Element) || !event.target.closest("[data-fullscreen-control],a")) enter();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      attempted.current = true;
      if (window.toeflDesktop?.fullscreen) void window.toeflDesktop.setFullscreen(false).catch(() => setMessage("창 닫기 또는 Alt+F4로 종료할 수 있습니다."));
      else if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
    // React 버튼 동작이 끝난 뒤 전체화면을 요청해 첫 클릭의 포커스/배치를 유지합니다.
    document.addEventListener("click", firstClick); document.addEventListener("fullscreenchange", change); window.addEventListener("toefl-desktop-fullscreen", change); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("click", firstClick); document.removeEventListener("fullscreenchange", change); window.removeEventListener("toefl-desktop-fullscreen", change); document.removeEventListener("keydown", escape); };
  }, [enter]);
  const toggle = () => {
    attempted.current = true;
    if (window.toeflDesktop) { void window.toeflDesktop.setFullscreen(!window.toeflDesktop.fullscreen).catch(() => setMessage("전용 창의 전체화면 전환을 확인해 주세요.")); return; }
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => setMessage("Esc로 전체화면을 해제해 주세요."));
    else enter();
  };
  return { active, supported, message, toggle };
}
