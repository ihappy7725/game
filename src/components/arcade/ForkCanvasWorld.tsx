"use client";

import { useEffect, useRef } from "react";
import { approachPose, branchPose, nextFork, type ForkLeg, type ForkPose } from "@/lib/fork-world";
import { ArcadeRunner } from "./ArcadeRunner";

export type ForkWorldProps = { origin: ForkPose; trail: ForkLeg[]; progress: number; transition: number; choice: number | null; phase: string; paused: boolean };
type Point = { x: number; y: number; z: number };

/** 영상 대신 선택한 경로의 월드 좌표를 투영합니다. 카메라와 지형이 함께 회전합니다. */
export function ForkCanvasWorld(props: ForkWorldProps) {
  const canvas = useRef<HTMLCanvasElement>(null), runner = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const paint = useRef<() => void>(() => {});
  useEffect(() => { latest.current = props; paint.current(); }, [props]);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ctx = el.getContext("2d"); if (!ctx) return;
    let width = innerWidth, height = innerHeight;
    const resize = () => { const box = el.getBoundingClientRect(); width = box.width; height = box.height; const ratio = Math.min(devicePixelRatio, 2); el.width = width * ratio; el.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw(); };
    const observer = new ResizeObserver(resize); observer.observe(el); resize();
    function draw() {
      if (document.hidden) return;
      const { origin, trail, progress, transition, choice, phase } = latest.current;
      const turning = phase === "cross" || phase === "fall";
      const player = turning ? branchPose(origin, choice ?? 0, transition) : approachPose(origin, phase === "run" ? progress : 0);
      const camera = { x: player.x - Math.sin(player.heading) * 18, z: player.z - Math.cos(player.heading) * 18, y: 7 };
      const c = Math.cos(player.heading), s = Math.sin(player.heading), focal = height * 1.05, horizon = height * .30;
      function project(p: Point) {
        const dx = p.x - camera.x, dz = p.z - camera.z, depth = dx * s + dz * c;
        return { x: width / 2 + (dx * c - dz * s) * focal / depth, y: horizon + (camera.y - p.y) * focal / depth, depth };
      }
      const sky = ctx!.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#72cce9"); sky.addColorStop(.48, "#d5f5ee"); sky.addColorStop(1, "#5fbbba"); ctx!.fillStyle = sky; ctx!.fillRect(0, 0, width, height);
      // 먼 산도 카메라 방향에 따라 이동해 회전하는 방향을 보여줍니다.
      for (let layer = 0; layer < 3; layer++) {
        ctx!.fillStyle = ["#a1cdbe", "#70ad9f", "#508f8a"][layer]; ctx!.beginPath(); ctx!.moveTo(0, height);
        for (let x = 0; x <= width + 20; x += 20) { const wave = x / width * 7 + player.heading * 1.5; ctx!.lineTo(x, horizon + layer * 45 - Math.abs(Math.sin(wave + layer) * 80) - Math.sin(wave * 2.2) * 20); }
        ctx!.lineTo(width, height); ctx!.fill();
      }
      const polygons: { points: Point[]; color: string; line?: string; depth: number }[] = [];
      function polygon(points: Point[], color: string, line?: string) { const depth = points.reduce((n, p) => n + project(p).depth, 0) / points.length; polygons.push({ points, color, line, depth }); }
      function edge(p: ForkPose, side: number, y = 0): Point { return { x: p.x + Math.cos(p.heading) * side, z: p.z - Math.sin(p.heading) * side, y }; }
      function strip(a: ForkPose, b: ForkPose, index: number, broken = false) {
        if (broken && index > 3) return;
        const aL = edge(a, -4), aR = edge(a, 4), bL = edge(b, -4), bR = edge(b, 4);
        polygon([aL, bL, bR, aR], index % 2 ? "#edc88e" : "#f6d79b");
        polygon([aL, edge(a, -4, -24), edge(b, -4, -24), bL], "#aa7959");
        polygon([aR, bR, edge(b, 4, -24), edge(a, 4, -24)], "#bc8963");
        for (const side of [-3.7, 3.7]) polygon([edge(a, side), edge(b, side), edge(b, side + .18), edge(a, side + .18)], "#fff0bc");
        if (index % 3 === 0) polygon([edge(a, -.06, .02), edge(b, -.06, .02), edge(b, .06, .02), edge(a, .06, .02)], "#d4a16f");
      }
      function straight(node: ForkPose) { for (let i = 0; i < 14; i++) strip(approachPose(node, i / 14), approachPose(node, (i + 1) / 14), i); }
      function branch(node: ForkPose, side: number, broken = false) { for (let i = 0; i < 12; i++) strip(branchPose(node, side, i / 12), branchPose(node, side, (i + 1) / 12), i, broken); }
      function tree(node: ForkPose, depth: number) {
        straight(node);
        for (const side of [0, 1]) {
          const broken = phase === "fall" && depth === 0 && side === (choice ?? 0);
          branch(node, side, broken);
          if (depth < 2 && !broken) tree(nextFork(node, side), depth + 1);
        }
        // 길 가장자리의 작은 침엽수와 표지석도 같은 월드 좌표를 사용합니다.
        const p = edge(approachPose(node, .5), 3.6), top = { ...p, y: 3.5 };
        polygon([{ ...p, x: p.x - .7 }, top, { ...p, x: p.x + .7 }], "#31866f");
      }
      if (!trail.length) straight({ ...origin, x: origin.x - Math.sin(origin.heading) * 44, z: origin.z - Math.cos(origin.heading) * 44 });
      for (const leg of trail) { straight(leg.origin); branch(leg.origin, leg.choice); }
      tree(origin, 0);
      polygons.sort((a, b) => b.depth - a.depth);
      for (const poly of polygons) {
        const projected = poly.points.map(project);
        if (projected.some(p => p.depth <= 1)) continue;
        ctx!.globalAlpha = Math.max(.18, 1 - Math.max(0, poly.depth - 95) / 250);
        ctx!.beginPath(); projected.forEach((p, i) => i ? ctx!.lineTo(p.x, p.y) : ctx!.moveTo(p.x, p.y)); ctx!.closePath(); ctx!.fillStyle = poly.color; ctx!.fill();
      }
      ctx!.globalAlpha = 1;
      const foot = project({ ...player, y: phase === "fall" ? -transition * transition * 25 : 0 });
      if (runner.current) { runner.current.style.left = `${foot.x}px`; runner.current.style.top = `${foot.y}px`; runner.current.style.opacity = phase === "fall" ? `${1 - transition}` : "1"; runner.current.style.setProperty("--runner-lean", turning ? `${choice === 0 ? -12 : 12}deg` : "0deg"); }
      el!.dataset.camera = `${camera.x.toFixed(2)},${camera.z.toFixed(2)},${player.heading.toFixed(2)}`;
    }
    paint.current = draw;
    // 게임 시계(30ms)와 화면 크기 변경 때만 그려 정지 중 불필요한 프레임을 만들지 않습니다.
    return () => { observer.disconnect(); paint.current = () => {}; };
  }, []);
  return <div className="fork-canvas-world" aria-label="선택한 방향으로 이어지는 절벽 맵" data-origin-x={props.origin.x.toFixed(2)} data-origin-z={props.origin.z.toFixed(2)} data-heading={props.origin.heading.toFixed(2)}>
    <canvas ref={canvas} aria-hidden="true"/>
    <div ref={runner} className="fork-live-runner"><ArcadeRunner facing="back" running={!props.paused && ["run", "cross"].includes(props.phase)}/></div>
  </div>;
}
