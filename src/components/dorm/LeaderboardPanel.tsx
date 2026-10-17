"use client";

import { useCallback, useEffect, useId, useState } from "react";
import { fetchGameLeaderboard, fetchWeeklyLeaderboard, type RankedGame } from "@/lib/api";
import { formatPopTime } from "@/lib/pop-records";
import { useGameResource } from "./useGameResource";
import { actionClass } from "./dorm-ui";

export function LeaderboardPanel({ userId }: { userId: string }) {
  const [category, setCategory] = useState("coins");
  return <section className="union-rankings" aria-label="주간 랭킹 모음"><nav aria-label="순위 종류" className="ranking-categories"><button aria-pressed={category === "coins"} onClick={() => setCategory("coins")}>학습 코인</button><button aria-pressed={category === "games"} onClick={() => setCategory("games")}>게임 기록</button></nav>
    <div hidden={category !== "coins"}><CoinRanking userId={userId}/></div>
    {category === "games" ? <GameRankings userId={userId}/> : null}
  </section>;
}
function CoinRanking({ userId }: { userId: string }) {
  const ranking = useGameResource(userId, fetchWeeklyLeaderboard);
  return (
    <section aria-label="주간 랭킹" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">주간 랭킹</h3><button type="button" onClick={ranking.reload} disabled={ranking.loading} className={actionClass}>랭킹 새로고침</button></div>
      <p className="text-xs text-white/60">이번 주 획득 코인 상위 20명입니다. 아이템을 뽑아도 이미 획득한 코인은 순위에 반영됩니다.</p>
      {ranking.loading ? <p role="status">순위를 불러오는 중...</p> : ranking.error ? <p role="alert" className="text-sm text-[#ffb4b0]">{ranking.error}</p>
        : ranking.data ? <>
          <p className="text-sm">{ranking.data.my_rank !== null ? `내 순위 ${ranking.data.my_rank}위` : "표시된 순위에 내 기록이 없습니다."}</p>
          {ranking.data.rows.length === 0 ? <p className="text-sm text-white/65">아직 이번 주 랭킹 기록이 없습니다.</p>
            : <ol className="space-y-2" aria-label="이번 주 순위">{ranking.data.rows.map((row) => <li key={row.rank} aria-current={row.is_me ? "true" : undefined}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${row.is_me ? "border-[#C9A227]/60 bg-[#C9A227]/10" : "border-white/10 bg-black/20"}`}>
              <span className="font-mono text-lg">{row.rank}</span><span className="min-w-0 flex-1 truncate text-sm">{row.display_name}{row.is_me ? " (나)" : ""}</span><span className="shrink-0 font-mono text-sm">{row.earned_this_week.toLocaleString("ko-KR")} 코인</span>
            </li>)}</ol>}
        </> : null}
    </section>
  );
}

function GameRankings({ userId }: { userId: string }) {
  const [game, setGame] = useState<RankedGame>("cab"); const [difficulty, setDifficulty] = useState(0); const [stage, setStage] = useState(1);
  const id = useId();
  return <section aria-label="게임별 주간 순위" className="game-rankings">
    <nav aria-label="순위 게임">{([["cab", "옐로캡 러시"], ["fork", "갈림길"], ["pop", "워드 팝"]] as const).map(([key, label]) => <button key={key} aria-pressed={key === game} onClick={() => setGame(key)}>{label}</button>)}</nav>
    <div className="ranking-filters"><div><label htmlFor={`${id}-difficulty`}>난이도</label><select id={`${id}-difficulty`} value={difficulty} onChange={e => setDifficulty(Number(e.target.value))}>{["기본", "심화", "도전"].map((name, i) => <option key={name} value={i}>{name}</option>)}</select></div>
    {game === "pop" ? <div><label htmlFor={`${id}-stage`}>스테이지</label><select id={`${id}-stage`} value={stage} onChange={e => setStage(Number(e.target.value))}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}단계</option>)}</select></div> : null}</div>
    <p>매주 월요일 0시(한국 시간)부터의 개인 최고 기록입니다. {game === "pop" ? "같은 단계·난이도에서 빠른 클리어 시간 순입니다." : "같은 난이도에서 높은 점수 순입니다."} 동점은 공동 순위입니다.</p>
    <GameRanking key={`${game}:${difficulty}:${stage}`} userId={userId} game={game} difficulty={difficulty} stage={game === "pop" ? stage : 0}/>
    <p className="ranking-note">클라이언트가 제출한 연습 기록이며 서버 재생 검증 전입니다. 이메일은 표시하지 않고 자동 별칭을 사용합니다. 메모리 카드는 자가 복습이므로 경쟁 순위에서 제외합니다.</p>
  </section>;
}
function GameRanking({ userId, game, difficulty, stage }: { userId: string; game: RankedGame; difficulty: number; stage: number }) {
  const fetcher = useCallback((token: string, signal: AbortSignal) => fetchGameLeaderboard(token, game, difficulty, stage, signal), [game, difficulty, stage]);
  const ranking = useGameResource(userId, fetcher);
  useEffect(() => { window.addEventListener("toefl-records-refresh", ranking.reload); return () => window.removeEventListener("toefl-records-refresh", ranking.reload); }, [ranking.reload]);
  return <div className="game-ranking-results"><button className={actionClass} onClick={ranking.reload} disabled={ranking.loading}>게임 순위 새로고침</button>
    {ranking.loading ? <p role="status">게임 순위를 불러오는 중…</p> : ranking.error ? <p role="alert">게임 순위를 불러오지 못했어요. 기록 서버의 연결을 확인해 주세요. 학습 코인 순위는 계속 이용할 수 있습니다.</p> : ranking.data ? <>
      <p>{ranking.data.my_rank === null ? "이번 조건의 내 기록이 아직 없습니다." : `내 게임 순위 ${ranking.data.my_rank}위`}</p>
      {!ranking.data.rows.length ? <p>아직 이번 주 게임 기록이 없습니다. 게임 종료 화면에서 기록을 저장해 보세요.</p> : <ol aria-label="이번 주 게임 순위">{ranking.data.rows.map((row, index) => <li key={`${row.rank}-${index}`} aria-current={row.is_me ? "true" : undefined}><b>{row.rank}위</b><span>{row.display_name}{row.is_me ? " (나)" : ""}</span><strong>{game === "pop" ? formatPopTime(row.elapsed_ms) : `${row.score.toLocaleString("ko-KR")}점`}</strong></li>)}</ol>}
    </> : null}
  </div>;
}
