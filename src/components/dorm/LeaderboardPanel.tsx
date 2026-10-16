"use client";

import { fetchWeeklyLeaderboard } from "@/lib/api";
import { useGameResource } from "./useGameResource";
import { actionClass } from "./dorm-ui";

export function LeaderboardPanel({ userId }: { userId: string }) {
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
