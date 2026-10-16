"use client";

import { useState } from "react";
import Link from "next/link";
import { useGameState } from "@/lib/game-state";

export function GameStatus() {
  const { auth, snapshot, refresh } = useGameState();
  const [open, setOpen] = useState(false);
  const data = snapshot?.data;
  const message = auth.status === "loading" ? "게임 세션 확인 중"
    : auth.status === "unconfigured" ? "게임 로그인 설정 필요"
    : auth.status === "signed-out" ? "로그인하면 코인·티어를 확인할 수 있습니다"
    : snapshot?.error ?? (data ? `${data.tier.name} · ${data.coin_balance.toLocaleString("ko-KR")} 코인` : "게임 정보 확인 중");

  return (
    <div className="col-span-2 row-start-3 min-w-0 sm:order-1">
      <button type="button" onClick={() => setOpen(!open)} title={message} aria-expanded={open} aria-label={`게임 정보: ${message}`}
        className="max-w-full truncate rounded-full border border-white/15 px-2 py-1 text-[11px]">
        {data ? <>{data.tier.emoji} <span className="hidden lg:inline">{data.tier.name} · </span>{data.coin_balance.toLocaleString("ko-KR")} 코인</> : snapshot?.error ? "⚠ 게임 정보" : "코인·티어"}
      </button>
      {open ? (
        <section aria-label="내 게임 정보" className="fixed inset-x-3 top-28 max-h-[60dvh] overflow-auto rounded-xl border border-white/20 bg-[#20180f] p-4 text-sm shadow-xl sm:inset-x-auto sm:top-10 sm:right-3 sm:w-80">
          <div className="flex justify-between gap-3"><h2 className="font-semibold">내 게임 정보</h2><button type="button" onClick={() => setOpen(false)} aria-label="게임 정보 닫기">닫기</button></div>
          <p role="status" className="mt-3">{message}</p>
          {data ? <div className="mt-3 space-y-2 text-white/70">
            <p>경험치 {data.xp.toLocaleString("ko-KR")} · 연속 학습 {data.streak_days}일</p>
            <p>{data.next_tier ? `${data.next_tier.name}까지 ${data.xp_to_next_tier?.toLocaleString("ko-KR")} 경험치` : "최고 티어에 도달했습니다."}</p>
          </div> : null}
          {auth.status === "signed-in" ? <button type="button" onClick={refresh} className="mt-4 rounded-lg border border-white/20 px-3 py-2">게임 정보 새로고침</button>
            : auth.status === "signed-out" ? <Link href="/login" className="mt-4 inline-block underline">로그인</Link> : null}
        </section>
      ) : null}
    </div>
  );
}
