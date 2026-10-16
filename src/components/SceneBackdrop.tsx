"use client";

import { useState } from "react";
import { SCENES, type SceneId } from "@/lib/scenes";
import { cn } from "@/lib/cn";

type SceneBackdropProps = {
  scene: SceneId;
  /** 위에 올릴 콘텐츠의 가독성을 위한 어둡게 깔기 */
  scrim?: boolean;
  className?: string;
};

/** 레퍼런스 사진을 배경으로 깔되, 파일이 없거나 로딩에 실패하면
 *  같은 색감의 순수 CSS 그래픽으로 대체한다. 어느 쪽이든 화면은 깨지지 않는다. */
export function SceneBackdrop({ scene, scrim = true, className }: SceneBackdropProps) {
  const [failed, setFailed] = useState(false);
  const config = SCENES[scene];

  return (
    <div className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}>
      {/* 폴백은 항상 깔아 둔다. 사진이 뜨면 그 위를 덮는 구조라
          이미지 디코딩 전 빈 화면이 보이는 구간이 없다. */}
      <div className="absolute inset-0" style={{ background: config.fallback }} />

      {!failed && (
        // next/image 대신 <img>를 쓴다. 파일이 없을 때 onError로 조용히
        // 폴백에 맡기려면 로더를 거치지 않는 편이 단순하고 확실하다.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={config.src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {scrim ? (
        <div className="absolute inset-0" style={{ background: config.scrim }} />
      ) : null}
    </div>
  );
}
