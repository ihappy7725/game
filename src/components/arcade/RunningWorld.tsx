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
    const branch = (z: number, side: number) => side * Math.max(0, z - 16) * .6;
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
        if(data.scene==="cab")ctx.drawImage(panorama, 0, 0, panorama.naturalWidth, panorama.naturalHeight * .46, 0, 0, width, height * .4);
        else ctx.drawImage(panorama,0,0,panorama.naturalWidth,panorama.naturalHeight,0,0,width,height);
      }
      const isCab = data.scene === "cab";
      if (isCab) { ctx.fillStyle="#b9c4b4";ctx.fillRect(0,height*.28,width,height*.72); }
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
      // 건물의 앞면·거리 쪽 측면·지붕을 실제 깊이 좌표로 투영합니다.
      const objects = Array.from({ length: 34 }, (_, i) => ({ i, z: 4 + ((i * 6.1 - travel.current) % 100 + 100) % 100 })).sort((a, b) => b.z - a.z);
      function texture(points: {x:number;y:number}[], side:number) {
        if(!panorama.complete || !panorama.naturalWidth)return;
        const sx=panorama.naturalWidth*(side<0?.01:.79), sy=panorama.naturalHeight*.17, sw=panorama.naturalWidth*.2, sh=panorama.naturalHeight*.48;
        for(const triangle of [[0,1,2],[0,2,3]]) {
          ctx.save();ctx.beginPath();triangle.forEach((i,j)=>j?ctx.lineTo(points[i].x,points[i].y):ctx.moveTo(points[i].x,points[i].y));ctx.closePath();ctx.clip();ctx.globalAlpha=.88;
          const [p0,p1,p2,p3]=points;
          if(triangle[1]===1)ctx.transform(p1.x-p0.x,p1.y-p0.y,p2.x-p1.x,p2.y-p1.y,p0.x,p0.y);
          else ctx.transform(p2.x-p3.x,p2.y-p3.y,p3.x-p0.x,p3.y-p0.y,p0.x,p0.y);
          ctx.drawImage(panorama,sx,sy,sw,sh,0,0,1,1);ctx.restore();
        }
      }
      for (const {i,z} of objects) {
        const side=i%2?1:-1;
        const inner=side*(isCab?3.8:14+(i%3)*4), outer=inner+side*(isCab?2.8:2.1);
        const depth=isCab?4.5:4; const roof=isCab?4.5+i%5:1+i%3;const floor=isCab?0:-14;
        const a=project(inner,z,roof),b=project(inner,z+depth,roof),c=project(inner,z+depth,floor),d=project(inner,z,floor);
        const e=project(outer,z,roof),f=project(outer,z+depth,roof),g=project(outer,z,floor);
        const visible=[a,b,c,d,e,f,g].some(p=>p.x>=-width*.2&&p.x<=width*1.2);
        if(!visible)continue;
        const tone=isCab?["#c88d72","#e6d1ac","#c0cec0","#d9b686"][i%4]:["#c08859","#d6a06b","#b97f57"][i%3];
        polygon([a,b,c,d],tone);polygon([a,e,g,d],isCab?"#a58d7b":"#ad764f");polygon([a,b,f,e],isCab?"#c0b9a0":"#a1b864");
        if(isCab && Math.abs(a.x-b.x)>10) { texture([a,b,c,d],side);texture([e,a,d,g],side); }
        if(isCab) {
          polygon([project(inner,z,.7),project(inner,z+depth,.7),project(inner,z+depth,.98),project(inner,z,.98)],i%2?"#368777":"#e5ba62");
          // 가로등과 나무도 깊이에 따라 자연스럽게 커지며 지나갑니다.
          const lamp=project(inner-side*.35,z+2,0),lampTop=project(inner-side*.35,z+2,2.5);
          ctx.strokeStyle="#476d64";ctx.lineWidth=Math.max(1,lamp.scale*2);ctx.beginPath();ctx.moveTo(lamp.x,lamp.y);ctx.lineTo(lampTop.x,lampTop.y);ctx.stroke();
          ctx.fillStyle="#fff0ae";ctx.beginPath();ctx.arc(lampTop.x,lampTop.y,Math.max(1,lampTop.scale*5),0,Math.PI*2);ctx.fill();
          if(i%3===0){const tree=project(inner-side*.55,z+3,1.7);ctx.fillStyle="#52956c";ctx.beginPath();ctx.ellipse(tree.x,tree.y,tree.scale*width*.027,tree.scale*height*.075,0,0,Math.PI*2);ctx.fill();}
        } else {
          for(let layer=0;layer<6;layer++) {const elevation=roof-(roof-floor)*(layer+1)/7;polygon([project(inner,z,elevation),project(inner,z+depth,elevation),project(inner,z+depth,elevation-.08),project(inner,z,elevation-.08)],"#ecc39080");}
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
