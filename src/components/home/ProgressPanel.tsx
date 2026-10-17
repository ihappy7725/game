"use client";

import { useState } from "react";
import { useGameState } from "@/lib/game-state";
import { useProgression } from "@/lib/progression";

export function ProgressPanel() {
  const { auth } = useGameState();
  const progress = useProgression();
  const [message, setMessage] = useState("");
  const myRow = progress.data?.ranking.rows.find(row => row.is_me);
  async function share() {
    if (!myRow) return;
    const text = `나의 TOEFL Union 주간 기록: ${myRow.rank}위 · ${myRow.earned_this_week.toLocaleString("ko-KR")} 획득 코인 · ${progress.title}! 함께 공부해요.`;
    try {
      if (navigator.share) { await navigator.share({ title: "나의 주간 학습 도전", text }); setMessage("공유했습니다."); }
      else { await navigator.clipboard.writeText(text); setMessage("주간 기록을 복사했습니다."); }
    } catch (error) { setMessage(error instanceof Error && error.name === "AbortError" ? "공유를 취소했습니다." : `직접 복사해 공유하세요: ${text}`); }
  }
  return <section className="progress-panel" aria-label="나의 성장과 도전">
    <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-bold">나의 성장과 도전</h3><button onClick={progress.refresh} className="hub-small-button">새로고침</button></div>
    <p className="mt-3 text-sm leading-relaxed">책상과 학습 코인 순위로 읽기·듣기 심화 문제가 열립니다. 미니게임의 중급·고급은 각 게임의 스테이지를 깨서 해제합니다.</p>
    {auth.status !== "signed-in" ? <p className="mt-3 text-sm">{auth.status === "loading" ? "로그인 상태 확인 중…" : "로그인하면 실제 책상과 주간 랭킹으로 성장 단계를 확인합니다. 기본 연습은 누구나 할 수 있습니다."}</p> : progress.loading ? <p role="status" className="mt-3">성장 정보 확인 중…</p> : progress.error ? <p role="alert" className="mt-3">{progress.error} 기본 연습을 이용할 수 있습니다.</p> : <p className="mt-3 font-semibold">{progress.title} · 책상 장식 {progress.points}점 · {progress.data?.ranking.my_rank ? `이번 주 ${progress.data.ranking.my_rank}위` : "이번 주 순위 미등록"}</p>}
    <ol className="mt-5 grid gap-3 sm:grid-cols-3">{["기본", "심화", "도전"].map((label, i) => <li key={label} className={`rounded-2xl border p-4 ${i <= progress.level ? "border-emerald-600/30 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}><p className="font-bold">{i <= progress.level ? "✓" : "🔒"} {label}</p><p className="mt-2 text-xs leading-relaxed">{["누구나 · 읽기·듣기 각 3문제", "장식 3점 또는 주간 20위 이내 · 6문제", "장식 8점 또는 주간 5위 이내 · 9문제"][i]}</p></li>)}</ol>
    <p className="mt-4 text-xs leading-relaxed text-slate-500">장식 점수: 배치한 종류별 일반 1 · 희귀 2 · 영웅 3 · 전설 5. 순위는 이번 주 획득 코인 기준이며 매주 달라집니다. 학습 난이도와 미니게임의 스테이지 해제는 별도로 관리합니다.</p>
    {myRow ? <button onClick={share} className="hub-primary mt-5">내 주간 기록 공유</button> : null}
    {message ? <p role="status" className="mt-3 text-sm select-text">{message}</p> : null}
  </section>;
}
