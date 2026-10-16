"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mic,
  PenLine,
  TriangleAlert,
} from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { GlassWindow } from "@/components/GlassWindow";
import { ScoreTrend } from "@/components/ScoreTrend";
import {
  ApiError,
  fetchStats,
  fetchSubmissions,
  type StatsResponse,
  type SubmissionListResponse,
  type SubmissionSection,
} from "@/lib/api";
import { SECTION_LABEL } from "@/lib/rubric";
import { useAuth } from "@/lib/useAuth";
import { SubmissionRow } from "./SubmissionRow";

const PAGE_SIZE = 10;

/** 섹션 필터. reading/listening 은 아직 제출 경로가 없으므로 뺍니다. */
const FILTERS = [
  { value: "all", label: "전체" },
  { value: "writing", label: "Writing" },
  { value: "speaking", label: "Speaking" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

/** 조회 오류를 화면용 문구로. 백엔드가 주는 detail 을 살리되 원인을 덧붙입니다. */
function describeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 401) {
      return "세션이 만료되었습니다. 다시 로그인해 주세요.";
    }
    if (err.status === 503) {
      return `백엔드에 Supabase 설정이 없습니다. ${err.message}`;
    }
    if (err.status === 502) {
      // supabase_schema.sql 을 아직 실행하지 않은 경우가 대표적입니다.
      return `기록 조회에 실패했습니다. Supabase SQL Editor 에서 supabase_schema.sql 을 실행했는지 확인해 주세요. (${err.message})`;
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (/failed to fetch/i.test(err.message)) {
      return "백엔드(localhost:8000)에 연결할 수 없습니다. FastAPI 서버가 실행 중인지 확인해 주세요.";
    }
    return err.message;
  }
  return "알 수 없는 오류가 발생했습니다.";
}

export function HistoryDashboard() {
  const { getAccessToken } = useAuth();

  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);

  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  const [list, setList] = useState<SubmissionListResponse | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(true);

  const section: SubmissionSection | undefined =
    filter === "all" ? undefined : filter;

  // --- 통계 + 추세 (섹션 필터에만 의존) ---------------------------------
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    (async () => {
      setStatsError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new ApiError("로그인이 필요합니다.", 401);
        const data = await fetchStats(token, { section }, controller.signal);
        if (active) setStats(data);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setStatsError(describeError(err));
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [section, getAccessToken]);

  // --- 제출 목록 (섹션 + 페이지) ----------------------------------------
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    (async () => {
      setListLoading(true);
      setListError(null);
      try {
        const token = await getAccessToken();
        if (!token) throw new ApiError("로그인이 필요합니다.", 401);
        const data = await fetchSubmissions(
          token,
          { section, limit: PAGE_SIZE, offset },
          controller.signal,
        );
        if (active) setList(data);
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setListError(describeError(err));
      } finally {
        if (active) setListLoading(false);
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [section, offset, getAccessToken]);

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = list ? Math.max(1, Math.ceil(list.total / PAGE_SIZE)) : 1;
  const isEmpty =
    stats !== null && stats.total_attempts === 0 && list?.items.length === 0;

  return (
    <div className="space-y-6">
      <GlassWindow title="학습 기록" toolbar={<AuthStatus />}>
        {/* 섹션 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  // 섹션을 바꾸면 첫 페이지로 돌아갑니다. effect 로 offset 을
                  // 되돌리면 한 번 더 렌더되며 이전 페이지를 잠깐 조회합니다.
                  setFilter(item.value);
                  setOffset(0);
                }}
                aria-pressed={active}
                className={
                  active
                    ? "rounded-full bg-accent-500/90 px-3.5 py-1.5 text-xs font-semibold text-white"
                    : "rounded-full border border-white/15 px-3.5 py-1.5 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white"
                }
              >
                {item.label}
              </button>
            );
          })}
          {stats ? (
            <span className="ml-auto font-mono text-xs text-white/40">
              총 {stats.total_attempts}회 · 최근 {stats.days}일
            </span>
          ) : null}
        </div>

        {statsError ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm leading-relaxed text-[#ffb4b0]"
          >
            {statsError}
          </p>
        ) : null}

        {/* 데이터 없음 */}
        {isEmpty ? <EmptyState /> : null}

        {/* 섹션별 집계 */}
        {stats && stats.sections.length > 0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {stats.sections.map((item, i) => (
              <motion.div
                key={item.section}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 260,
                  damping: 28,
                  delay: 0.05 + i * 0.05,
                }}
                className="glass-soft glass-sheen rounded-[var(--radius-card)] p-5"
              >
                <div className="flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold tracking-tight text-white">
                    {SECTION_LABEL[item.section]}
                  </h3>
                  <span className="font-mono text-xs text-white/40">
                    {item.attempts}회
                  </span>
                </div>

                <div className="mt-4 flex items-end gap-6">
                  <div>
                    <p className="text-[11px] tracking-wide text-white/45">평균</p>
                    <p className="mt-0.5 font-mono text-2xl font-semibold text-white">
                      {item.avg_score?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-wide text-white/45">최고</p>
                    <p className="mt-0.5 font-mono text-2xl font-semibold text-accent-300">
                      {item.best_score?.toFixed(0) ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-wide text-white/45">
                      최근 14일
                    </p>
                    <p className="mt-0.5 font-mono text-2xl text-white/70">
                      {item.avg_score_14d?.toFixed(1) ?? "—"}
                    </p>
                  </div>
                </div>

                {item.last_attempt_at ? (
                  <p className="mt-4 border-t border-white/10 pt-3 text-xs text-white/40">
                    마지막 응시 {new Date(item.last_attempt_at).toLocaleDateString("ko-KR")}
                  </p>
                ) : null}
              </motion.div>
            ))}
          </div>
        ) : null}
      </GlassWindow>

      {/* 점수 추세 */}
      {stats && stats.trend.length > 0 ? (
        <GlassWindow title="점수 추세" delay={0.05}>
          <p className="mb-5 text-xs text-white/45">
            환산 점수(0~30) · 가로축은 제출 순서입니다. 점에 마우스를 올리면 날짜와
            점수가 보입니다.
          </p>
          <ScoreTrend points={stats.trend} />
        </GlassWindow>
      ) : null}

      {/* 제출 목록 */}
      <GlassWindow title="최근 제출" delay={0.1}>
        {listError ? (
          <p
            role="alert"
            className="rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm leading-relaxed text-[#ffb4b0]"
          >
            {listError}
          </p>
        ) : null}

        {listLoading && !list ? (
          <div className="flex items-center gap-2.5 py-6 text-sm text-white/45">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            불러오는 중...
          </div>
        ) : null}

        {list && list.items.length === 0 && !listError ? (
          <p className="py-4 text-sm text-white/45">
            {filter === "all"
              ? "아직 제출 기록이 없습니다."
              : `${SECTION_LABEL[filter as SubmissionSection]} 제출 기록이 없습니다.`}
          </p>
        ) : null}

        {list && list.items.length > 0 ? (
          <>
            <ul className="divide-y divide-white/8">
              {list.items.map((item) => (
                <SubmissionRow
                  key={item.id}
                  item={item}
                  getAccessToken={getAccessToken}
                />
              ))}
            </ul>

            {/* 페이지네이션 */}
            {list.total > PAGE_SIZE ? (
              <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
                <button
                  type="button"
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0 || listLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
                  이전
                </button>

                <span className="font-mono text-xs text-white/45">
                  {page} / {totalPages} 페이지 · 전체 {list.total}건
                </span>

                <button
                  type="button"
                  onClick={() => setOffset(offset + PAGE_SIZE)}
                  disabled={!list.has_more || listLoading}
                  className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3 py-1.5 text-xs text-white/70 transition-colors hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  다음
                  <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </GlassWindow>
    </div>
  );
}

/** 기록이 하나도 없을 때. 다음 행동으로 바로 이어 줍니다. */
function EmptyState() {
  return (
    <div className="mt-6 rounded-[var(--radius-card)] border border-white/10 bg-white/[0.03] p-6">
      <div className="flex items-start gap-3">
        <TriangleAlert
          className="mt-0.5 h-5 w-5 shrink-0 text-signal-400"
          strokeWidth={1.75}
          aria-hidden
        />
        <div>
          <h3 className="text-sm font-semibold text-white">
            아직 쌓인 기록이 없습니다
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            로그인한 상태로 첨삭을 받으면 결과가 계정에 저장되고, 이 화면에
            섹션별 평균·최고 점수와 추세가 그려집니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2.5">
            <Link
              href="/writing"
              className="flex items-center gap-1.5 rounded-xl bg-accent-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400"
            >
              <PenLine className="h-3.5 w-3.5" aria-hidden />
              Writing 첨삭 받기
            </Link>
            <Link
              href="/speaking"
              className="flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-white/80 transition-colors hover:border-white/30 hover:text-white"
            >
              <Mic className="h-3.5 w-3.5" aria-hidden />
              Speaking 첨삭 받기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
