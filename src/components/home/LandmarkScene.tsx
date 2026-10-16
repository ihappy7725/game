"use client";

import { useEffect, useState } from "react";
import type { OsMode } from "@/lib/os-theme";
import { BackgroundVideo } from "./BackgroundVideo";

/** 홈 영상 경로만 매니페스트로 교체할 수 있습니다. */
export function LandmarkScene({ mode, moving = true }: { mode: OsMode; moving?: boolean }) {
  const [manifest, setManifest] = useState<Partial<Record<OsMode, string>>>({});
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/backgrounds/scene-videos.json", { signal: controller.signal }).then(r => r.ok ? r.json() : {}).then((data: unknown) => {
      const raw = data && typeof data === "object" ? data as Record<string, unknown> : {};
      const next: Partial<Record<OsMode, string>> = {};
      for (const key of ["arcade", "study"] as const) if (typeof raw[key] === "string" && /^\/backgrounds\/[a-z0-9/_-]+\.(mp4|webm)$/i.test(raw[key] as string)) next[key] = raw[key] as string;
      setManifest(next);
    }).catch(() => {});
    return () => controller.abort();
  }, []);
  return <BackgroundVideo className={'landmark-scene scene-' + mode} src={manifest[mode]} poster={'/backgrounds/' + (mode === "study" ? "study" : "arcade") + '-loop.jpg'} moving={moving} />;
}
