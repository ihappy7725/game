"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

function subscribeMotion(update: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", update);
  return () => query.removeEventListener("change", update);
}
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** 배경 음성은 재생하지 않으며 숨김·일시정지·동작 줄이기를 존중합니다. */
export function BackgroundVideo({ src, poster, moving = true, className = "" }: {
  src?: string; poster: string; moving?: boolean; className?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const reduce = useSyncExternalStore(subscribeMotion, reducedMotion, () => true);
  const video = useRef<HTMLVideoElement>(null);
  const available = Boolean(src && src !== failed);
  useEffect(() => {
    const element = video.current;
    if (!element || !available) return;
    let active = true; let generation = 0;
    const apply = () => {
      const token = ++generation;
      element.muted = true;
      if (!moving || reduce || document.hidden) element.pause();
      else void element.play().catch((error: unknown) => {
        if (!active || token !== generation || (error instanceof DOMException && error.name === "AbortError")) return;
        if (src) setFailed(src);
      });
    };
    apply(); document.addEventListener("visibilitychange", apply); element.addEventListener("loadeddata", apply);
    return () => { active = false; generation++; element.pause(); document.removeEventListener("visibilitychange", apply); element.removeEventListener("loadeddata", apply); };
  }, [src, available, moving, reduce]);
  return <div aria-hidden="true" data-moving={moving} data-scene-kind={available ? "video" : "poster"} className={className} style={{ backgroundImage: `url(${poster})` }}>
    {available ? <video key={src} ref={video} data-background-video="true" className="scene-video" src={src} poster={poster} muted loop playsInline preload="metadata" onError={() => { if (src) setFailed(src); }} /> : null}
  </div>;
}
