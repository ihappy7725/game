"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

const KEY = "toefl-opening-seen-v1";
const EVENT = "toefl-opening-finished";
let completed = false;
function seen() { try { return completed || sessionStorage.getItem(KEY) === "1"; } catch { return completed; } }
function subscribe(update: () => void) { window.addEventListener(EVENT, update); return () => window.removeEventListener(EVENT, update); }

export function useOpeningSequence() {
  const alreadySeen = useSyncExternalStore(subscribe, seen, () => false);
  const [phase, setPhase] = useState<"play" | "out" | "black" | "in" | "done">("play");
  const finish = useCallback(() => setPhase(current => current === "play" ? "out" : current), []);
  useEffect(() => {
    if (alreadySeen || phase === "play" || phase === "done") return;
    const timer = setTimeout(() => {
      if (phase === "out") setPhase("black");
      else if (phase === "black") setPhase("in");
      else {
        completed = true;
        try { sessionStorage.setItem(KEY, "1"); } catch { /* 저장이 막힌 경우 현재 페이지에서만 기억합니다. */ }
        setPhase("done"); window.dispatchEvent(new Event(EVENT));
      }
    }, phase === "out" ? 650 : phase === "black" ? 200 : 850);
    return () => clearTimeout(timer);
  }, [alreadySeen, phase]);
  return { active: !alreadySeen && phase !== "done", phase, finish };
}

export function OpeningSequence({ sequence, muted, toggleSound }: { sequence: ReturnType<typeof useOpeningSequence>; muted: boolean; toggleSound: () => void }) {
  const video = useRef<HTMLVideoElement>(null), panel = useRef<HTMLDivElement>(null);
  const phase = useRef(sequence.phase);
  const [autoplayMuted, setAutoplayMuted] = useState(false), [blocked, setBlocked] = useState(false), [failed, setFailed] = useState(false);
  const finish = sequence.finish;
  useEffect(() => { phase.current = sequence.phase; if (sequence.phase !== "play") video.current?.pause(); }, [sequence.phase]);
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    panel.current?.focus();
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      if (e.key === "Tab") {
        const buttons = Array.from(panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        if (!buttons.length) return;
        if (e.shiftKey && (document.activeElement === buttons[0] || document.activeElement === panel.current)) { e.preventDefault(); buttons.at(-1)?.focus(); }
        else if (!e.shiftKey && (document.activeElement === buttons.at(-1) || document.activeElement === panel.current)) { e.preventDefault(); buttons[0].focus(); }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handle);
      // 재방문 수화 중 생략되는 영상은 사용자의 포커스를 빼앗지 않습니다.
      if (phase.current !== "play") document.querySelector<HTMLElement>(".hub-launchers button")?.focus();
    };
  }, [finish]);
  useEffect(() => {
    const el = video.current; if (!el) return;
    let live = true;
    const resume = () => {
      if (document.hidden || phase.current !== "play") el.pause();
      else void el.play().catch((error: DOMException) => {
        if (!live || error.name === "AbortError") return;
        // 초기 HTML의 영상 오류가 수화 전에 발생한 경우에도 재생 실패를 안내합니다.
        if (el.error || error.name === "NotSupportedError") setFailed(true);
        else if(error.name === "NotAllowedError" && !el.muted) {
          el.muted=true; setAutoplayMuted(true);
          void el.play().catch(() => { if(live)setBlocked(true); });
        } else setBlocked(true);
      });
    };
    resume(); document.addEventListener("visibilitychange", resume);
    return () => { live = false; el.pause(); document.removeEventListener("visibilitychange", resume); };
  }, []);
  function sound() {
    const turnOn=muted || autoplayMuted;
    if(turnOn) { if(muted)toggleSound();setAutoplayMuted(false); }
    else toggleSound();
    if(video.current) { video.current.muted=!turnOn;void video.current.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true)); }
  }
  return <div ref={panel} className="opening-sequence" data-phase={sequence.phase} role="dialog" aria-modal="true" aria-label="토플 유니온 오프닝" tabIndex={-1}>
    <video ref={video} data-opening-video src="/backgrounds/intro.mp4" poster="/backgrounds/intro.jpg" autoPlay playsInline muted={autoplayMuted || muted} preload="auto" onEnded={finish} onError={() => setFailed(true)}/>
    {sequence.phase === "play" ? <div className="opening-controls">
      <p>{failed ? "오프닝을 재생할 수 없어요. 홈으로 이동해 주세요." : autoplayMuted ? "브라우저가 소리 자동재생을 제한했어요 · Esc로 건너뛰기" : "오프닝 · Esc로 건너뛰기"}</p>
      <div>{!failed ? <button onClick={sound}>{autoplayMuted || muted ? "오프닝 소리 켜기" : "오프닝 소리 끄기"}</button> : null}{blocked && !failed ? <button onClick={() => { void video.current?.play().then(() => setBlocked(false)).catch(() => {}); }}>영상 재생</button> : null}<button onClick={finish}>오프닝 건너뛰기</button></div>
    </div> : null}
  </div>;
}
