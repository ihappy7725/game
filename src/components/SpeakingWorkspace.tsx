"use client";

import { useId, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Mic, RotateCcw, Sparkles, Square } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { StudyFrame } from "@/components/StudyFrame";
import { GlassWindow } from "@/components/GlassWindow";
import { ApiError, evaluateSpeaking, type SpeakingEvaluation } from "@/lib/api";
import { useAuth } from "@/lib/useAuth";

/** breakdown 키를 한글 라벨로 (백엔드 SPEAKING_SCHEMA와 동일한 키) */
const RUBRIC_LABEL: Record<string, string> = {
  delivery: "전달력",
  language_use: "언어 사용",
  topic_development: "내용 전개",
};

/** ETS 루브릭 만점 (Speaking은 4점 척도) */
const RUBRIC_MAX = 4;

/** 과제 유형별 권장 답변 길이(초). 실제 시험에서 Task 1은 45초, Task 2~4는 60초입니다. */
const TASK_TYPES = [
  { value: "independent", label: "Task 1 · 독립형 의견", target: 45 },
  { value: "campus_situation", label: "Task 2 · 캠퍼스 상황", target: 60 },
  { value: "academic_lecture", label: "Task 3 · 학술 읽기 + 강의", target: 60 },
  { value: "academic_summary", label: "Task 4 · 강의 요약", target: 60 },
] as const;

/** 경고를 띄우는 상한. 넘겨도 녹음을 강제로 끊지는 않습니다. */
const HARD_LIMIT_SECONDS = 60;

/** 브라우저가 지원하는 녹음 포맷 중 백엔드가 받는 것을 고릅니다.
 *  webm(Chrome/Edge/Firefox)을 우선하고, Safari는 mp4로 떨어집니다. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const type of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  // isTypeSupported가 모두 false라도 브라우저 기본값으로 시도해 볼 수 있습니다.
  return "";
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** getUserMedia 실패 원인을 사용자가 할 수 있는 조치로 바꿔 줍니다.
 *  거부를 조용히 삼키면 버튼이 먹지 않는 것처럼 보이므로 항상 문구를 남깁니다. */
function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "마이크 권한이 거부되었습니다. 주소창 왼쪽의 자물쇠(또는 마이크) 아이콘을 눌러 이 사이트의 마이크를 '허용'으로 바꾼 뒤 다시 시도해 주세요.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "사용할 수 있는 마이크를 찾지 못했습니다. 마이크가 연결되어 있는지 확인해 주세요.";
    case "NotReadableError":
    case "TrackStartError":
      return "마이크를 다른 프로그램이 사용하고 있어 열 수 없습니다. 화상회의 앱 등을 종료한 뒤 다시 시도해 주세요.";
    case "SecurityError":
      return "보안 설정 때문에 마이크를 사용할 수 없습니다. HTTPS 또는 localhost에서 접속해 주세요.";
    default:
      return err instanceof Error
        ? `마이크를 사용할 수 없습니다: ${err.message}`
        : "마이크를 사용할 수 없습니다.";
  }
}

/** 백엔드가 돌려주는 상태 코드별 보충 안내. detail 문구는 이미 한국어이므로 덧붙이기만 합니다. */
function submitErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 415:
        return `${err.message} 이 브라우저의 녹음 포맷을 백엔드가 받지 못했습니다. Chrome 또는 Edge에서 다시 시도해 주세요.`;
      case 413:
        return `${err.message} 녹음을 60초 안팎으로 짧게 다시 해 주세요.`;
      case 422:
        return `${err.message}`;
      case 400:
        return `${err.message} 녹음이 저장되지 않았을 수 있으니 다시 녹음해 주세요.`;
      default:
        return err.message;
    }
  }
  if (err instanceof TypeError) {
    // fetch 자체가 실패한 경우 (백엔드가 꺼져 있거나 CORS)
    return "백엔드에 연결할 수 없습니다. FastAPI 서버(localhost:8000)가 실행 중인지 확인해 주세요.";
  }
  return err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
}

type RecordingState = "idle" | "requesting" | "recording" | "recorded";

export function SpeakingWorkspace({ embedded = false, active = true }: { embedded?: boolean; active?: boolean }) {
  const activeRef = useRef(active);
  const fieldId = useId();
  // 로그인한 상태면 access token 을 함께 보냅니다. 그래야 백엔드가 제출 기록을
  // user_id 와 함께 저장하고, /history 에서 다시 볼 수 있습니다.
  const { state: authState, getAccessToken } = useAuth();
  const [taskType, setTaskType] = useState<string>("independent");
  const [question, setQuestion] = useState("");

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [takeSeconds, setTakeSeconds] = useState(0);

  const [result, setResult] = useState<SpeakingEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // 언마운트 정리에서 최신 URL을 해제하기 위한 미러
  const audioUrlRef = useRef<string | null>(null);
  const mountedRef = useRef(false);

  const target =
    TASK_TYPES.find((t) => t.value === taskType)?.target ?? HARD_LIMIT_SECONDS;

  /** 마이크를 완전히 놓아줍니다. 트랙을 멈추지 않으면 탭의 녹음 표시등이 계속 켜져 있습니다. */
  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // 페이지를 떠날 때 녹음기·마이크·타이머·objectURL을 모두 정리합니다.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onerror = null;
        recorderRef.current.stop();
      }
      recorderRef.current = null;
      releaseMic();
      if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    };
  }, [clearTimer, releaseMic]);

  useEffect(() => {
    activeRef.current = active;
    if (!active && recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      clearTimer();
      releaseMic();
    }
  }, [active, clearTimer, releaseMic]);

  function discardTake() {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setAudioUrl(null);
    blobRef.current = null;
    chunksRef.current = [];
    setElapsed(0);
    setTakeSeconds(0);
    setResult(null);
    setError(null);
  }

  async function startRecording() {
    discardTake();

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "이 브라우저에서는 녹음을 지원하지 않습니다. 최신 Chrome·Edge·Safari에서 HTTPS 또는 localhost로 접속해 주세요.",
      );
      return;
    }

    const mimeType = pickMimeType();
    if (mimeType === null) {
      setError("이 브라우저는 MediaRecorder를 지원하지 않아 녹음할 수 없습니다.");
      return;
    }

    setRecordingState("requesting");

    let stream: MediaStream;
    try {
      // 첫 사용 시 브라우저가 권한 창을 띄웁니다.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // 권한 요청 중 창을 닫아도 뒤늦게 도착한 마이크를 남겨 두지 않습니다.
      if (!mountedRef.current || !activeRef.current) {
        if (mountedRef.current) setRecordingState("idle");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setRecordingState("idle");
      setError(micErrorMessage(err));
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      // 녹음기를 만들지 못하면 이미 열린 마이크를 반드시 닫아야 합니다.
      stream.getTracks().forEach((track) => track.stop());
      setRecordingState("idle");
      setError(
        err instanceof Error
          ? `녹음을 시작할 수 없습니다: ${err.message}`
          : "녹음을 시작할 수 없습니다.",
      );
      return;
    }

    streamRef.current = stream;
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };

    recorder.onstop = () => {
      clearTimer();
      releaseMic();

      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      chunksRef.current = [];

      if (blob.size === 0) {
        setRecordingState("idle");
        setError("녹음된 소리가 없습니다. 마이크 입력을 확인하고 다시 시도해 주세요.");
        return;
      }

      blobRef.current = blob;
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      setAudioUrl(url);
      setRecordingState("recorded");
    };

    recorder.onerror = () => {
      clearTimer();
      releaseMic();
      setRecordingState("idle");
      setError("녹음 중 오류가 발생했습니다. 다시 시도해 주세요.");
    };

    recorder.start();
    setRecordingState("recording");

    // 경과 시간은 시작 시각과의 차이로 계산해 간격 누적 오차를 피합니다.
    const startedAt = Date.now();
    setElapsed(0);
    timerRef.current = setInterval(() => {
      const seconds = (Date.now() - startedAt) / 1000;
      setElapsed(seconds);
      setTakeSeconds(seconds);
    }, 200);
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      // 안전망: 녹음기가 이미 멈춰 있어도 마이크는 놓아줍니다.
      clearTimer();
      releaseMic();
      setRecordingState("idle");
    }
  }

  async function handleSubmit() {
    if (!blobRef.current || authState.status !== "signed-in" || isLoading) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const accessToken = await getAccessToken();
      if (!accessToken) throw new Error("로그인 세션을 확인하지 못했어요. 다시 로그인해 주세요.");
      const data = await evaluateSpeaking(
        blobRef.current,
        {
          question: question.trim() || undefined,
          task_type: taskType,
        },
        accessToken,
      );
      setResult(data);
    } catch (err) {
      setError(submitErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const isRecording = recordingState === "recording";
  const isRequesting = recordingState === "requesting";
  const hasTake = recordingState === "recorded" && audioUrl !== null;
  const overTarget = isRecording && elapsed > target;
  const overHardLimit = elapsed > HARD_LIMIT_SECONDS;
  const progress = Math.min((elapsed / HARD_LIMIT_SECONDS) * 100, 100);

  return (
    <StudyFrame embedded={embedded}>
      <GlassWindow title="Speaking 첨삭" toolbar={<AuthStatus />}>
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
              disabled={isRecording || isRequesting}
              className="glass-soft w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none disabled:opacity-50"
            >
              {TASK_TYPES.map((t) => (
                <option key={t.value} value={t.value} className="bg-ink-800">
                  {t.label} (권장 {t.target}초)
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
              placeholder="Some people prefer to study alone. Others prefer to study with a group. Which do you prefer and why?"
              className="glass-soft w-full resize-y rounded-xl px-3.5 py-3 text-sm leading-relaxed text-white placeholder:text-white/25 outline-none"
            />
          </div>

          {/* 녹음 패널 */}
          <div className="glass-soft rounded-xl px-4 py-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                {isRecording ? (
                  <motion.span
                    aria-hidden
                    animate={{ opacity: [1, 0.25, 1] }}
                    transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]"
                  />
                ) : (
                  <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-white/20" />
                )}
                <span className="text-xs tracking-wide text-white/50">
                  {isRecording
                    ? "녹음 중"
                    : isRequesting
                      ? "마이크 권한 확인 중"
                      : hasTake
                        ? "녹음 완료"
                        : "대기 중"}
                </span>
              </div>

              <p
                aria-live="off"
                className={`font-mono text-3xl font-semibold tabular-nums ${
                  overHardLimit ? "text-signal-400" : "text-white"
                }`}
              >
                {formatTime(hasTake ? takeSeconds : elapsed)}
                <span className="ml-1.5 text-sm font-normal text-white/35">
                  / 권장 {target}초
                </span>
              </p>
            </div>

            {/* 60초 기준 진행 바 */}
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className={`h-full rounded-full transition-[width] duration-200 ease-linear ${
                  overHardLimit
                    ? "bg-signal-400"
                    : "bg-gradient-to-r from-accent-500 to-accent-300"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <AnimatePresence>
              {overTarget ? (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  role="status"
                  className="mt-3 text-xs leading-relaxed text-signal-400"
                >
                  권장 {target}초를 넘었습니다. 실제 시험에서는 여기서 녹음이 끊기니
                  마무리 문장으로 넘어가세요.
                </motion.p>
              ) : null}
            </AnimatePresence>

            {/* 녹음 / 정지 / 다시 녹음 */}
            <div className="mt-5 flex flex-wrap gap-3">
              {isRecording ? (
                <motion.button
                  type="button"
                  onClick={stopRecording}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#ff5f57] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ff5f57]/20 transition-colors hover:bg-[#ff7b74]"
                >
                  <Square className="h-4 w-4 fill-current" aria-hidden />
                  녹음 정지
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  onClick={startRecording}
                  disabled={isRequesting || isLoading}
                  whileHover={isRequesting || isLoading ? undefined : { y: -2 }}
                  whileTap={isRequesting || isLoading ? undefined : { scale: 0.98 }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
                >
                  {isRequesting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      마이크 권한 요청 중...
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" aria-hidden />
                      {hasTake ? "다시 녹음" : "녹음 시작"}
                    </>
                  )}
                </motion.button>
              )}

              {hasTake && !isLoading ? (
                <motion.button
                  type="button"
                  onClick={discardTake}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="glass-soft flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white/70 transition-colors hover:text-white"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  녹음 삭제
                </motion.button>
              ) : null}
            </div>

            {/* 제출 전 들어보기 */}
            {hasTake ? (
              <div className="mt-5 border-t border-white/10 pt-4">
                <p className="mb-2 text-xs font-medium tracking-wide text-white/50">
                  제출 전 들어보기
                </p>
                <audio src={audioUrl ?? undefined} controls className="w-full" />
              </div>
            ) : null}
          </div>

          <motion.button
            type="button"
            onClick={handleSubmit}
            disabled={!hasTake || isLoading || authState.status !== "signed-in"}
            whileHover={hasTake && !isLoading && authState.status === "signed-in" ? { y: -2 } : undefined}
            whileTap={hasTake && !isLoading && authState.status === "signed-in" ? { scale: 0.98 } : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Whisper 전사 후 GPT-4o가 채점하는 중...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" aria-hidden />
                채점 받기
              </>
            )}
          </motion.button>

          {/* 녹음 연습은 열어 두고 유료 채점은 로그인 후에만 요청합니다. */}
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
              className="rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm leading-relaxed text-[#ffb4b0]"
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
                    <span className="ml-1 text-sm text-white/35">
                      / {RUBRIC_MAX.toFixed(1)}
                    </span>
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
                        {item.score.toFixed(1)} / {RUBRIC_MAX}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(item.score / RUBRIC_MAX) * 100}%` }}
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

            {/* Whisper 전사 결과 */}
            <GlassWindow title="전사 결과 (Whisper)" delay={0.1}>
              <p className="text-sm leading-[1.8] whitespace-pre-wrap text-white/80">
                {result.transcript}
              </p>
              <p className="mt-4 border-t border-white/10 pt-3 font-mono text-xs text-white/40">
                {result.transcript.split(/\s+/).filter(Boolean).length} words
              </p>
            </GlassWindow>

            {/* 교정된 모범 답안 */}
            <GlassWindow title="모범 답안 스크립트" delay={0.15}>
              <p className="text-sm leading-[1.8] whitespace-pre-wrap text-white/80">
                {result.corrected_response}
              </p>
            </GlassWindow>

            {/* 다음 연습 과제 */}
            <GlassWindow title="다음 연습 과제" delay={0.2}>
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
