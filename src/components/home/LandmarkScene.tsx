"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { OsMode } from "@/lib/os-theme";

function subscribeMotion(update: () => void) { const query=window.matchMedia("(prefers-reduced-motion: reduce)");query.addEventListener("change",update);return()=>query.removeEventListener("change",update); }
const reducedMotion=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/** 완성된 루프 영상이 등록되면 배경 전체를 재생합니다. 미등록·실패 시 포스터를 유지합니다. */
export function LandmarkScene({ mode, moving = true }: { mode: OsMode; moving?: boolean }) {
  const [manifest,setManifest]=useState<Partial<Record<OsMode,string>>>({});
  const [failed,setFailed]=useState<string|null>(null);
  const reduce=useSyncExternalStore(subscribeMotion,reducedMotion,()=>true);
  const video=useRef<HTMLVideoElement>(null);
  const source=manifest[mode];
  const available=Boolean(source && source!==failed);
  const poster=`/backgrounds/${mode==="study" ? "campus-evening-v3" : "liberty-city-v3"}.webp`;
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/backgrounds/scene-videos.json",{signal:controller.signal}).then(r=>r.ok?r.json():{}).then(data=>{
      const next:Partial<Record<OsMode,string>>={};
      for(const key of ["arcade","study"] as const) if(typeof data[key]==="string" && /^\/backgrounds\/[a-z0-9/_-]+\.(mp4|webm)$/i.test(data[key]))next[key]=data[key];
      setManifest(next);
    }).catch(()=>{});
    return()=>controller.abort();
  },[]);
  useEffect(()=>{
    const element=video.current;if(!element || !available)return;
    const apply=()=>{element.muted=true;if(!moving || reduce || document.hidden)element.pause();else void element.play().catch(()=>{if(source)setFailed(source);});};
    apply();document.addEventListener("visibilitychange",apply);
    return()=>{element.pause();document.removeEventListener("visibilitychange",apply);};
  },[source,available,moving,reduce]);
  return <div aria-hidden="true" data-moving={moving} data-scene-kind={available ? "video" : "poster"} className={`landmark-scene scene-${mode}`} style={{backgroundImage:`url(${poster})`}}>
    {available ? <video key={source} ref={video} className="scene-video" src={source} poster={poster} muted loop playsInline preload="metadata" onError={()=>{if(source)setFailed(source);}}/> : null}
  </div>;
}
