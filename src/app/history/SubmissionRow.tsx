"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Mic, PenLine } from "lucide-react";
import {
  ApiError,
  fetchSubmissionDetail,
  type SubmissionDetail,
  type SubmissionListItem,
  type SubmissionSection,
} from "@/lib/api";
import {
  RUBRIC_LABEL,
  SECTION_LABEL,
  TASK_TYPE_LABEL,
  formatDateTime,
  rubricMaxFor,
} from "@/lib/rubric";

type Props = {
  item: SubmissionListItem;
  /** 상세를 펼칠 때 쓸 access token 접근자 (토큰은 호출 직전에 받아 옵니다) */
  getAccessToken: () => Promise<string | null>;
};

function SectionIcon({ section }: { section: SubmissionSection }) {
  const className = "h-4 w-4";
  if (section === "speaking") {
    return <Mic className={className} strokeWidth={1.75} aria-hidden />;
  }
  return <PenLine className={className} strokeWidth={1.75} aria-hidden />;
}

/** 목록의 한 줄. 누르면 GET /api/submissions/{id} 로 상세를 가져와 펼칩니다.
 *  한 번 가져온 상세는 다시 접었다 펴도 재요청하지 않습니다. */
export function SubmissionRow({ item, getAccessToken }: Props) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<SubmissionDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);

    if (detail || loading) return;

    setLoading(true);
    setError(null);
    try {
      const token = await getAccessToken();
      if (!token) throw new ApiError("세션이 만료되었습니다. 다시 로그인해 주세요.", 401);
      setDetail(await fetchSubmissionDetail(token, item.id));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "상세를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  const taskLabel = item.task_type
    ? (TASK_TYPE_LABEL[item.task_type] ?? item.task_type)
    : null;

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-3.5 px-1 py-4 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="glass-soft mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-accent-300">
          <SectionIcon section={item.section} />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <span className="text-sm font-medium text-white">
              {SECTION_LABEL[item.section]}
            </span>
            {taskLabel ? (
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] text-white/50">
                {taskLabel}
              </span>
            ) : null}
            <span className="font-mono text-[11px] text-white/35">
              {formatDateTime(item.created_at)}
            </span>
          </span>

          {item.excerpt ? (
            <span className="mt-1.5 block truncate text-[13px] text-white/50">
              {item.excerpt}
            </span>
          ) : null}
        </span>

        <span className="flex shrink-0 items-center gap-3">
          <span className="text-right">
            <span className="block font-mono text-lg leading-none font-semibold text-white">
              {item.estimated_score?.toFixed(0) ?? "—"}
            </span>
            <span className="mt-1 block font-mono text-[10px] text-white/35">
              / 30
            </span>
          </span>
          <motion.span
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 24 }}
            className="text-white/35"
          >
            <ChevronDown className="h-4 w-4" aria-hidden />
          </motion.span>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
            className="overflow-hidden"
          >
            <div className="px-1 pb-5">
              {loading ? (
                <div className="flex items-center gap-2.5 py-3 text-sm text-white/45">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  상세를 불러오는 중...
                </div>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm text-[#ffb4b0]"
                >
                  {error}
                </p>
              ) : null}

              {detail ? <SubmissionDetailBody detail={detail} /> : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}

/** 펼쳐진 상세: 총평 → 루브릭 세부 점수 → 교정문 → 연습 과제 */
function SubmissionDetailBody({ detail }: { detail: SubmissionDetail }) {
  const rubricMax = rubricMaxFor(detail.section);
  const breakdown = Object.entries(detail.breakdown);
  // Speaking 은 transcript, Writing 은 user_response 가 원문입니다.
  const original = detail.transcript ?? detail.user_response;

  return (
    <div className="space-y-5 rounded-[var(--radius-card)] border border-white/10 bg-white/[0.03] p-5">
      {/* 점수 요약 */}
      <div className="flex flex-wrap items-end gap-6">
        <div>
          <p className="text-[11px] tracking-wide text-white/45">예상 환산 점수</p>
          <p className="mt-0.5 font-mono text-3xl font-semibold text-white">
            {detail.estimated_score?.toFixed(0) ?? "—"}
            <span className="ml-1 text-base text-white/35">/ 30</span>
          </p>
        </div>
        <div className="pb-1">
          <p className="text-[11px] tracking-wide text-white/45">ETS 루브릭</p>
          <p className="mt-0.5 font-mono text-xl text-accent-300">
            {detail.rubric_score?.toFixed(1) ?? "—"}
            <span className="ml-1 text-xs text-white/35">/ {rubricMax.toFixed(1)}</span>
          </p>
        </div>
        {detail.word_count != null ? (
          <div className="pb-1.5">
            <p className="text-[11px] tracking-wide text-white/45">분량</p>
            <p className="mt-0.5 font-mono text-sm text-white/70">
              {detail.word_count} words
            </p>
          </div>
        ) : null}
        {detail.duration_seconds != null ? (
          <div className="pb-1.5">
            <p className="text-[11px] tracking-wide text-white/45">길이</p>
            <p className="mt-0.5 font-mono text-sm text-white/70">
              {detail.duration_seconds.toFixed(0)}초
            </p>
          </div>
        ) : null}
      </div>

      {detail.summary ? (
        <p className="text-sm leading-relaxed text-white/70">{detail.summary}</p>
      ) : null}

      {/* 루브릭 세부 점수 */}
      {breakdown.length > 0 ? (
        <section>
          <h4 className="text-xs font-medium tracking-wide text-white/50">
            루브릭 세부 점수
          </h4>
          <ul className="mt-3 space-y-3.5">
            {breakdown.map(([key, entry], i) => (
              <li key={key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] font-medium text-white/85">
                    {RUBRIC_LABEL[key] ?? key}
                  </span>
                  <span className="font-mono text-[11px] text-white/50">
                    {entry.score.toFixed(1)} / {rubricMax}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, (entry.score / rubricMax) * 100)}%`,
                    }}
                    transition={{ duration: 0.5, delay: i * 0.06, ease: "easeOut" }}
                    className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-300"
                  />
                </div>
                {entry.comment ? (
                  <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                    {entry.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {detail.question_prompt ? (
        <section>
          <h4 className="text-xs font-medium tracking-wide text-white/50">문제 지문</h4>
          <p className="mt-2 text-[13px] leading-relaxed whitespace-pre-wrap text-white/60">
            {detail.question_prompt}
          </p>
        </section>
      ) : null}

      {original ? (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium tracking-wide text-white/50 transition-colors hover:text-white/75">
            {detail.section === "speaking" ? "전사 결과 (Whisper)" : "제출 원문"}
          </summary>
          <p className="mt-2 text-[13px] leading-[1.75] whitespace-pre-wrap text-white/65">
            {original}
          </p>
        </details>
      ) : null}

      {detail.corrected_text ? (
        <section>
          <h4 className="text-xs font-medium tracking-wide text-white/50">
            {detail.section === "speaking" ? "모범 답안 스크립트" : "교정문"}
          </h4>
          <p className="mt-2 text-[13px] leading-[1.75] whitespace-pre-wrap text-white/80">
            {detail.corrected_text}
          </p>
        </section>
      ) : null}

      {detail.actionable_tips.length > 0 ? (
        <section>
          <h4 className="text-xs font-medium tracking-wide text-white/50">
            연습 과제
          </h4>
          <ol className="mt-3 space-y-2.5">
            {detail.actionable_tips.map((tip, i) => (
              <li
                key={i}
                className="flex gap-2.5 text-[13px] leading-relaxed text-white/75"
              >
                <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full bg-accent-500/20 font-mono text-[10px] text-accent-300">
                  {i + 1}
                </span>
                {tip}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {detail.model ? (
        <p className="border-t border-white/10 pt-3 font-mono text-[10px] text-white/30">
          채점 모델 {detail.model}
        </p>
      ) : null}
    </div>
  );
}
