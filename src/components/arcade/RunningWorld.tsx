"use client";

import { useEffect, useRef } from "react";

type Props = { scene: "cab" | "fork"; running: boolean; paused?: boolean; progress?: number; steering?: number };
/** 전방 지형을 원근 투영합니다. 도로·건물·바위의 깊이가 매 프레임 이동합니다. */
export function RunningWorld(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const latest = useRef(props);
  const travel = useRef(0);
  useEffect(() => { latest.current = props; }, [props]);
  useEffect(() => {
    const element = canvas.current; if (!element) return;
    const context = element.getContext("2d"); if (!context) return;
    let width = 1; let height = 1; let frame = 0; let last = 0; let alive = true;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const panorama = new Image(); panorama.src = `/arcade/${props.scene === "cab" ? "cab" : "cliff"}-world-v1.webp`;
    const project = (x: number, z: number, elevation = 0) => {
      const scale = 5 / Math.max(2, z);
      const camera = (latest.current.steering ?? 0) * (latest.current.scene === "fork" ? .65 : .12);
      return { x: width / 2 + (x - camera) * scale * width * .12, y: height * .28 + scale * height * .5 - elevation * scale * height * .1, scale };
    };
    function polygon(points: { x: number; y: number }[], color: string) {
      context!.fillStyle = color; context!.beginPath(); points.forEach((p, i) => i ? context!.lineTo(p.x, p.y) : context!.moveTo(p.x, p.y)); context!.closePath(); context!.fill();
    }
    const branch = (z: number, side: number) => side * Math.max(0, z - 22) * .13;
    function render(now = 0) {
      if (!alive) return;
      const data = latest.current;
      const moving = data.running && !data.paused && !document.hidden && !motion.matches;
      if (moving && last) travel.current += Math.min(80, now - last) / 1000 * (data.scene === "cab" ? 20 : 12);
      last = now;
      const ctx = context!;
      const sky = ctx.createLinearGradient(0, 0, 0, height); sky.addColorStop(0, "#81d1f2"); sky.addColorStop(.5, "#e7f6e9"); sky.addColorStop(1, data.scene === "cab" ? "#7f9ba3" : "#5c9f9e");
      ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
      if (panorama.complete && panorama.naturalWidth) {
        // 원경은 위쪽에만 사용하고 가까운 지형은 실시간으로 그립니다.
        ctx.drawImage(panorama, 0, 0, panorama.naturalWidth, panorama.naturalHeight * .46, 0, 0, width, height * .4);
      }
      const isCab = data.scene === "cab";
      if (!isCab) {
        for (let i = 0; i < 8; i++) {
          const x = (i * .17 % 1) * width; const peak = height * (.16 + (i % 3) * .04);
          polygon([{ x: x - width * .1, y: height * .43 }, { x, y: peak }, { x: x + width * .13, y: height * .43 }], ["#9cc7bb", "#8eb9ad", "#79ada7"][i % 3]);
        }
        ctx.fillStyle = "#509caa"; ctx.fillRect(0, height * .62, width, height * .38);
      }
      for (let z = 96; z > 3; z -= 2) {
        const near = Math.max(3, z - 2);
        const stripe = Math.floor((z + travel.current) / 3) % 2 === 0;
        for (const side of isCab ? [0] : [-1, 1]) {
          const farCenter = isCab ? 0 : branch(z, side); const nearCenter = isCab ? 0 : branch(near, side);
          const half = isCab ? 3.3 : 1.45;
          const a = project(farCenter - half, z), b = project(farCenter + half, z), c = project(nearCenter + half, near), d = project(nearCenter - half, near);
          if (!isCab) {
            polygon([b, c, { x: c.x, y: c.y + c.scale * height * .35 }, { x: b.x, y: b.y + b.scale * height * .35 }], stripe ? "#b4744d" : "#a36b49");
            polygon([a, d, { x: d.x, y: d.y + d.scale * height * .35 }, { x: a.x, y: a.y + a.scale * height * .35 }], stripe ? "#cb8a59" : "#b47b50");
          }
          polygon([a, b, c, d], isCab ? stripe ? "#73828b" : "#77868d" : stripe ? "#eab77b" : "#e5ae6d");
          for (const edge of [-1, 1]) polygon([project(farCenter + edge * (half - .14), z), project(farCenter + edge * half, z), project(nearCenter + edge * half, near), project(nearCenter + edge * (half - .14), near)], isCab ? "#e9d5aa" : "#ffd99b");
          if (isCab && stripe) for (const lane of [-1.1, 1.1]) polygon([project(lane - .025, z), project(lane + .025, z), project(lane + .025, near), project(lane - .025, near)], "#f5f5d8");
        }
      }
      // 양옆의 입체 건물/절벽이 카메라를 향해 다가와 뒤로 지나갑니다.
      const objects = Array.from({ length: 42 }, (_, i) => ({ i, z: 4 + ((i * 5.7 - travel.current) % 100 + 100) % 100 })).sort((a, b) => b.z - a.z);
      for (const { i, z } of objects) {
        const side = i % 2 ? 1 : -1;
        const x = side * (isCab ? 4.1 + (i % 3) * .65 : 5 + (i % 4) * 1.8);
        const base = project(x, z); const top = project(x, z, isCab ? 4 + i % 5 : 3 + i % 7);
        const w = base.scale * width * (isCab ? .13 : .12);
        if (base.x + w < -width * .2 || base.x - w > width * 1.2) continue;
        const tone = isCab ? ["#c78468", "#ead5b0", "#adc5bc", "#d4aa7c"][i % 4] : ["#c38a5e", "#b97c54", "#d39c69"][i % 3];
        const offset = w * side * .28;
        polygon([{ x: base.x - w / 2, y: base.y }, { x: top.x - w / 2, y: top.y }, { x: top.x + w / 2, y: top.y }, { x: base.x + w / 2, y: base.y }], tone);
        polygon([{ x: top.x + w / 2, y: top.y }, { x: top.x + w / 2 + offset, y: top.y - w * .17 }, { x: base.x + w / 2 + offset, y: base.y - w * .17 }, { x: base.x + w / 2, y: base.y }], isCab ? "#8c8b7e" : "#987552");
        polygon([{ x: top.x - w / 2, y: top.y }, { x: top.x - w / 2 + offset, y: top.y - w * .17 }, { x: top.x + w / 2 + offset, y: top.y - w * .17 }, { x: top.x + w / 2, y: top.y }], isCab ? "#e4d9b6" : "#90ac60");
        if (isCab && w > 6) {
          const floors = 3 + i % 4; const h = base.y - top.y;
          ctx.fillStyle = i % 3 ? "#4e7882" : "#fff0b6";
          for (let row = 0; row < floors; row++) for (let col = 0; col < 3; col++) ctx.fillRect(top.x - w * .4 + col * w * .29, top.y + h * (.1 + row / floors), w * .16, h / floors * .43);
          ctx.fillStyle = i % 2 ? "#367d73" : "#dda94b"; ctx.fillRect(base.x - w * .52, base.y - h * .13, w * 1.04, h * .06);
        } else if (!isCab) {
          ctx.fillStyle = "#e6bd8a80"; for (let line = 1; line < 5; line++) ctx.fillRect(top.x - w / 2, top.y + (base.y - top.y) * line / 5, w, Math.max(1, w * .015));
        }
      }
      const haze = ctx.createLinearGradient(0, height * .25, 0, height * .55); haze.addColorStop(0, "#e5f4dd80"); haze.addColorStop(1, "#e5f4dd00"); ctx.fillStyle = haze; ctx.fillRect(0, height * .25, width, height * .3);
      element!.dataset.distance = travel.current.toFixed(2);
      if (moving) frame = requestAnimationFrame(render);
    }
    const resize = () => { const rect = element.getBoundingClientRect(); width = rect.width; height = rect.height; const dpr = Math.min(2, window.devicePixelRatio || 1); element.width = Math.round(width * dpr); element.height = Math.round(height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0); cancelAnimationFrame(frame); last = 0; render(); };
    const refresh = () => { cancelAnimationFrame(frame); last = 0; render(); };
    const observer = new ResizeObserver(resize); observer.observe(element); panorama.onload = refresh;
    document.addEventListener("visibilitychange", refresh); motion.addEventListener("change", refresh); resize();
    return () => { alive = false; cancelAnimationFrame(frame); observer.disconnect(); panorama.onload = null; motion.removeEventListener("change", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, [props.scene, props.running, props.paused]);
  return <canvas ref={canvas} className="running-world" data-scene={props.scene} aria-hidden="true"/>;
}
