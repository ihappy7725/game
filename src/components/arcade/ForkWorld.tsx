"use client";

import { useEffect, useRef, useState } from "react";
import { ForkCanvasWorld, type ForkWorldProps } from "./ForkCanvasWorld";
import { BackgroundVideo } from "@/components/home/BackgroundVideo";

/** 3D 엔진은 게임에 들어온 뒤 로드하고 미지원 기기는 기존 맵으로 이어집니다. */
export function ForkWorld(props: ForkWorldProps) {
  const host=useRef<HTMLDivElement>(null),latest=useRef(props);
  const engine=useRef<ReturnType<typeof import("./fork-three-engine").createForkEngine>|null>(null);
  const [renderer,setRenderer]=useState("loading");
  useEffect(()=>{latest.current=props;engine.current?.update(props);},[props]);
  useEffect(()=>{
    let live=true;
    void import("./fork-three-engine").then(({createForkEngine})=>{
      if(!live || !host.current)return;
      engine.current=createForkEngine(host.current,latest.current,()=>{if(live){engine.current?.dispose();engine.current=null;setRenderer("fallback");}});
      setRenderer("webgl");
    }).catch(()=>{if(live)setRenderer("fallback");});
    return()=>{live=false;engine.current?.dispose();engine.current=null;};
  },[]);
  return <div className="fork-live-world" aria-label="선택한 방향으로 이어지는 절벽 맵" data-renderer={renderer} data-origin-x={props.origin.x.toFixed(2)} data-origin-z={props.origin.z.toFixed(2)} data-heading={props.origin.heading.toFixed(2)}>
    <div className="fork-cinematic-scene" aria-hidden="true">
      <div className="fork-painted-distance"/>
      {/* 영상 인물이 포함되지 않는 상단 하늘 영역만 원경 모션으로 사용합니다. */}
      <div className="fork-sky-crop"><BackgroundVideo src="/backgrounds/fork-loop.mp4" poster="/backgrounds/fork-loop.jpg" moving={!props.paused && ["run","cross","fall"].includes(props.phase)} className="fork-sky-video"/></div>
      <div className="fork-sun-haze"/>
    </div>
    <div ref={host} className="fork-webgl-host"/>
    {renderer==="fallback" ? <><ForkCanvasWorld {...props}/><small className="fork-graphics-note">간소화 그래픽 모드</small></> : null}
    {renderer==="loading" ? <small className="fork-graphics-note">3D 절벽을 준비하고 있어요…</small> : null}
  </div>;
}
