"use client";

import { useState } from "react";

export function ShareScore({ game, score }: { game: string; score: number }) {
  const [message,setMessage]=useState("");
  async function share() {
    const text=`TOEFL Union · ${game}에서 ${score}점! 나의 연습 기록에 도전해 보세요. (화면 내 연습 점수 · 공식 랭킹 점수와 별도)`;
    try { if(navigator.share) await navigator.share({title:"나의 영어 게임 도전",text});else await navigator.clipboard.writeText(text);setMessage("기록을 공유하거나 복사했습니다."); }
    catch(error) { setMessage(error instanceof Error && error.name==="AbortError" ? "공유를 취소했습니다." : `직접 복사하세요: ${text}`); }
  }
  return <div className="mt-4 space-y-2"><button type="button" className="rounded-xl border border-white/25 px-4 py-2.5 text-sm hover:bg-white/10" onClick={share}>게임 점수 공유</button>{message ? <p role="status" className="text-xs select-text">{message}</p> : null}</div>;
}
