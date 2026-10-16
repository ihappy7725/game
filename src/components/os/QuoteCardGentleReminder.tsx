"use client";

import { cn } from "@/lib/cn";

/** 레퍼런스 사진(quote-gentle-reminder.jpg)의 CSS 재현.
 *
 *  사진에서 가져온 값
 *   - 배경: 순백, 여백이 넉넉함
 *   - 머리말: 분홍 흘림체 이탤릭 "Gentle Reminder"
 *   - 본문: 큰 세리프. 형광펜이 단어가 아니라 "줄 전체"를 덮는다
 *     → box-decoration-break: clone 으로 줄마다 핑크 띠가 생기게 처리
 *   - hard, can't. 만 굵은 이탤릭
 *   - 하단 보조문은 양끝 정렬(justify)
 */

const SERIF = "Georgia, 'Times New Roman', 'Noto Serif KR', serif";

export function QuoteCardGentleReminder({ className }: { className?: string }) {
  return (
    <figure
      className={cn(
        "relative select-none overflow-hidden rounded-[6px] bg-white px-8 py-9 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      <figcaption
        className="mb-3 text-[0.72rem] font-medium tracking-wide text-[#C9808D] italic"
        style={{ fontFamily: SERIF }}
      >
        Gentle Reminder
      </figcaption>

      <blockquote style={{ fontFamily: SERIF }}>
        {/* 핑크 형광펜이 줄 단위로 깔리도록 inline 요소 + clone */}
        <p
          className="text-[clamp(1.4rem,3.6vw,2.3rem)] leading-[1.42] tracking-tight text-[#141210]"
          aria-label="Just because it's hard doesn't mean you can't."
        >
          <span
            className="[box-decoration-break:clone] [-webkit-box-decoration-break:clone] bg-[#FDE8E8] px-[0.12em] py-[0.06em]"
            aria-hidden
          >
            Just because it&apos;s <em className="font-bold italic">hard</em> doesn&apos;t mean you{" "}
            <em className="font-bold italic">can&apos;t.</em>
          </span>
        </p>

        <p
          className="mt-4 text-[clamp(0.82rem,1.7vw,1rem)] leading-[1.6] text-[#2A2724]"
          style={{ textAlign: "justify" }}
        >
          Hard doesn&apos;t mean impossible. You can do this. Take one step at a time.
        </p>
      </blockquote>
    </figure>
  );
}
