"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

type PhotoStickerProps = {
  src: string;
  /** 사진 위에 얹는 문구 */
  caption: string;
  /** 사진이 없을 때 쓰는 CSS 배경 */
  fallback: string;
  /** 문구 서체 분위기 */
  tone?: "serif" | "sans";
  className?: string;
};

/** 폴라로이드 느낌의 사진 스티커 위젯.
 *  사진 파일이 없으면 같은 분위기의 CSS 배경으로 대체되고 문구는 그대로 남는다. */
export function PhotoSticker({
  src,
  caption,
  fallback,
  tone = "serif",
  className,
}: PhotoStickerProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure
      className={cn(
        "relative select-none overflow-hidden rounded-[10px] bg-black shadow-[0_20px_44px_-16px_rgba(0,0,0,0.7)]",
        className,
      )}
    >
      <div className="absolute inset-0" style={{ background: fallback }} />

      {!failed && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {/* 문구는 사진이 없을 때만 그린다.
          레퍼런스 사진에는 이미 같은 글자가 박혀 있어서, 겹쳐 얹으면 두 번 보인다.
          사진이 뜨면 캡션은 스크린리더용으로만 남긴다. */}
      {failed ? (
        <figcaption
          className={cn(
            "absolute inset-x-0 top-1/2 -translate-y-1/2 px-5 text-center text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]",
            tone === "serif"
              ? "text-[clamp(1.1rem,3vw,1.7rem)] italic"
              : "text-[clamp(1.1rem,3vw,1.7rem)] font-semibold tracking-tight",
          )}
          style={
            tone === "serif"
              ? { fontFamily: "Georgia, 'Times New Roman', serif" }
              : undefined
          }
        >
          {caption}
        </figcaption>
      ) : (
        <figcaption className="sr-only">{caption}</figcaption>
      )}
    </figure>
  );
}
