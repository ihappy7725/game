"use client";

import { cn } from "@/lib/cn";

/** 레퍼런스 사진(quote-win-learn.jpg)의 CSS 재현.
 *
 *  사진 그대로 띄우지 않는 이유: 확대해도 선명하고, 폭에 맞춰 줄바꿈되며,
 *  스크린리더가 문장을 읽을 수 있기 때문.
 *
 *  사진에서 가져온 값
 *   - 종이: 거친 크림색 #F4F1EA, 미세한 그레인과 옅은 비네트
 *   - 형광펜: #E6E22E, 글자보다 아주 약간 넓게 번진 블록
 *   - 밑줄: #B91C1C, 손으로 그은 듯 끝이 살짝 어긋남
 *   - 서체: 올드스타일 세리프
 */

const SERIF = "Georgia, 'Times New Roman', 'Noto Serif KR', serif";

function Marked({ children }: { children: string }) {
  return (
    <span className="relative inline-block">
      {/* 형광펜: 글자 뒤에 깔리고 위아래로 살짝 넘치게.
          z-index 대신 "칠하는 순서"로 겹친다. 같은 쌓임 맥락에서는 뒤에 온
          형제가 위에 그려지므로 형광펜 → 글자 → 밑줄 순으로 둔다.
          (-z-10을 주면 카드 배경 뒤로 밀려 아예 보이지 않는다) */}
      <span
        aria-hidden
        className="absolute -inset-x-[0.08em] -top-[0.04em] bottom-[0.02em] bg-[#E6E22E]"
      />
      <span className="relative">{children}</span>
      {/* 빨간 펜 밑줄: 수평에서 0.4deg 틀어 손으로 그은 느낌 */}
      <span
        aria-hidden
        className="absolute inset-x-[-0.02em] bottom-[-0.06em] h-[0.055em] origin-left -rotate-[0.4deg] rounded-full bg-[#B91C1C]"
      />
    </span>
  );
}

export function QuoteCardWinLearn({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        "relative select-none overflow-hidden rounded-[6px] bg-[#F4F1EA] px-7 py-10 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      {/* 종이 그레인 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.16] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='p'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23p)'/%3E%3C/svg%3E\")",
        }}
      />
      {/* 가장자리 비네트 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(130% 110% at 50% 45%, transparent 55%, rgba(120,110,95,0.16) 100%)",
        }}
      />

      <blockquote
        className="relative text-[clamp(1.05rem,2.6vw,1.6rem)] leading-[1.75] tracking-tight text-[#141210]"
        style={{ fontFamily: SERIF }}
      >
        <p>
          Sometimes <Marked>you win.</Marked>
        </p>
        <p>
          Sometimes <Marked>you learn.</Marked>
        </p>
      </blockquote>
    </figure>
  );
}
