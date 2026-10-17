"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { StudyFrame } from "@/components/StudyFrame";
import { GlassWindow } from "@/components/GlassWindow";
import { evaluateWriting, type WritingEvaluation } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

/** breakdown 키를 한글 라벨로 (백엔드 WRITING_SCHEMA와 동일한 키) */
const RUBRIC_LABEL: Record<string, string> = {
  task_fulfillment: "과제 수행",
  organization: "구성·응집성",
  grammar: "문법·문장 구조",
  vocabulary: "어휘",
  mechanics: "철자·형식",
};

const TASK_TYPES = [
  { value: "independent", label: "Independent (독립형)" },
  { value: "integrated", label: "Integrated (통합형)" },
  { value: "academic_discussion", label: "Academic Discussion (토론형)" },
] as const;

export function WritingWorkspace({ embedded = false }: { embedded?: boolean }) {
  const fieldId = useId();
  // 로그인한 상태면 access token 을 함께 보냅니다. 그래야 백엔드가 제출 기록을
  // user_id 와 함께 저장하고, /history 에서 다시 볼 수 있습니다.
  const { state: authState, getAccessToken } = useAuth();
  const [essay, setEssay] = useState("");
  const [question, setQuestion] = useState("");
  const [taskType, setTaskType] = useState<string>("independent");
  const [result, setResult] = useState<WritingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const wordCount = useMemo(
    () => essay.trim().split(/\s+/).filter(Boolean).length,
    [essay],
  );
  // 백엔드가 50자 미만을 거부하므로 버튼에서 미리 막습니다.
  const canSubmit = authState.status === "signed-in" && essay.trim().length >= 50 && !isLoading;

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("로그인 세션을 확인하지 못했어요. 다시 로그인해 주세요.");
      const data = await evaluateWriting(
        {
          essay,
          question: question.trim() || undefined,
          task_type: taskType,
        },
        accessToken,
      );
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <StudyFrame embedded={embedded}>
      <GlassWindow title="Writing 첨삭" toolbar={<AuthStatus />}>
        <div className="space-y-5">
          <div>
            <label
              htmlFor={fieldId + "-task-type"}
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              과제 유형
            </label>
            <select
              id={fieldId + "-task-type"}
              value={taskType}
              onChange={(e) => setTaskType(e.target.value)}
              className="glass-soft w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-ink-800">
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor={fieldId + "-question"}
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              문제 지문 <span className="text-white/30">(선택)</span>
            </label>
            <textarea
              id={fieldId + "-question"}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              rows={3}
              placeholder="Do you agree or disagree with the following statement? ..."
              className="glass-soft w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-white/25 outline-none"
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <label
                htmlFor={fieldId + "-essay"}
                className="block text-xs font-medium tracking-wide text-white/50"
              >
                에세이 본문
              </label>
              <span className="font-mono text-xs text-white/40">{wordCount} words</span>
            </div>
            <textarea
              id={fieldId + "-essay"}
              value={essay}
              onChange={(e) => setEssay(e.target.value)}
              rows={12}
              placeholder="여기에 영문 에세이를 붙여넣거나 작성하세요. (최소 50자)"
              className="glass-soft w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-white/25 outline-none"
            />
          </div>

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            whileHover={canSubmit ? { y: -2 } : undefined}
            whileTap={canSubmit ? { scale: 0.98 } : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                GPT-4o가 채점하는 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                채점 받기
              </>
            )}
          </motion.button>

          {/* 입력 연습은 열어 두고 유료 채점은 로그인 후에만 요청합니다. */}
          {authState.status === "signed-out" ? (
            <p className="text-xs leading-relaxed text-white/40">
              AI 채점은 로그인 후 이용할 수 있습니다.{" "}
              <Link href="/login" className="text-accent-300 hover:underline">
                로그인
              </Link>
              하고 채점 결과를 학습 기록에 저장하세요.
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm text-[#ffb4b0]"
            >
              {error}
            </p>
          ) : null}
        </div>
      </GlassWindow>

      <AnimatePresence>
        {result ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 space-y-6"
          >
            {/* 점수 + 루브릭 세부 항목 */}
            <GlassWindow title="채점 결과" delay={0.05}>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <p className="text-xs tracking-wide text-white/45">예상 환산 점수</p>
                  <p className="mt-1 font-mono text-5xl font-semibold text-white">
                    {result.estimated_score.toFixed(0)}
                    <span className="ml-1 text-xl text-white/35">/ 30</span>
                  </p>
                </div>
                <div className="pb-1.5">
                  <p className="text-xs tracking-wide text-white/45">ETS 루브릭</p>
                  <p className="mt-1 font-mono text-2xl text-accent-300">
                    {result.rubric_score.toFixed(1)}
                    <span className="ml-1 text-sm text-white/35">/ 5.0</span>
                  </p>
                </div>
              </div>

              <p className="mt-5 text-sm leading-relaxed text-white/70">
                {result.summary}
              </p>

              <ul className="mt-6 space-y-4">
                {Object.entries(result.breakdown).map(([key, item], i) => (
                  <li key={key}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium text-white/85">
                        {RUBRIC_LABEL[key] ?? key}
                      </span>
                      <span className="font-mono text-xs text-white/50">
                        {item.score.toFixed(1)} / 5
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.score / 5) * 100}%` }}
                        transition={{ duration: 0.6, delay: 0.1 + i * 0.07, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-accent-500 to-accent-300"
                      />
                    </div>
                    <p className="mt-2 text-[13px] leading-relaxed text-white/55">
                      {item.comment}
                    </p>
                  </li>
                ))}
              </ul>
            </GlassWindow>

            {/* 교정된 에세이 */}
            <GlassWindow title="교정된 에세이" delay={0.1}>
              <p className="text-sm leading-[1.8] whitespace-pre-wrap text-white/80">
                {result.corrected_essay}
              </p>
            </GlassWindow>

            {/* 다음 연습 과제 */}
            <GlassWindow title="다음 연습 과제" delay={0.15}>
              <ol className="space-y-3">
                {result.actionable_tips.map((tip, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed text-white/75">
                    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-500/20 font-mono text-[11px] text-accent-300">
                      {i + 1}
                    </span>
                    {tip}
                  </li>
                ))}
              </ol>

              {result.save_error ? (
                <p className="mt-5 border-t border-white/10 pt-4 text-xs text-signal-400/80">
                  채점은 완료되었습니다. 다만 {result.save_error}
                </p>
              ) : null}
            </GlassWindow>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </StudyFrame>
  );
}
