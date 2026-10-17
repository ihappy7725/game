"use client";

import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { GameOutcome } from "./GameOutcome";
import { ShareScore } from "./ShareScore";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Heart, Keyboard, RotateCcw, Zap } from "lucide-react";
import { ArcadeEffects } from "./ArcadeEffects";
import { buildLanes, shuffledDeck, type VocabItem } from "@/lib/vocab";
import { ResultPages } from "./ResultPages";
import { GameHud } from "./GameHud";
import { useGamePause } from "./GamePause";
import { useArcadeTicker } from "./useArcadeTicker";
import { useGameLearning } from "@/lib/learning-progress";
import { cabDuration } from "@/lib/game-tempo";
import { cn } from "@/lib/cn";
import { useGameState } from "@/lib/game-state";
import type { VocabAnswer } from "@/lib/api";
import { GameResultSave } from "./GameResultSave";
import { useRankedAttempt, type RankedAttempt } from "@/lib/useRankedAttempt";
import { RankedRecordSave } from "./RankedRecordSave";

/** 옐로캡 러시 — 토플 어휘 동의어 러닝 액션.
 *
 *  위에 뜬 단어의 동의어가 적힌 차선으로 제한 시간 안에 택시를 옮긴다.
 *
 *  설계 메모
 *   - 판정은 전부 setTimeout 으로 한다. 애니메이션 이벤트에 걸면
 *     prefers-reduced-motion 환경(globals.css 가 transition/animation 을 꺼버림)에서
 *     라운드가 영원히 끝나지 않는다.
 *   - 로그인한 계정으로 시작한 판만 종료 화면에서 보상·오답을 한 번 저장한다.
 */
const FEEDBACK_MS = 900;
const FEVER_AT = 5;
const START_LIVES = 3;

type Phase = "ready" | "running" | "over";
type Stage = "drive" | "judge";

type Round = {
  key: number;
  item: VocabItem;
  lanes: string[];
  correctLane: number;
};

type LastResult = {
  correct: boolean;
  item: VocabItem;
  chosen: string;
};

export function YellowCabRush({ difficulty = 0 }: { difficulty?: number }) {
  const {begin:beginLearning,correct:learnCorrect,milestone:clearStage} = useGameLearning("cab", difficulty);
  const { paused, setPaused } = useGamePause();
  const roundClock = useRef(0), feedbackClock = useRef(0), runClock = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const [correctTotal,setCorrectTotal] = useState(0);
  const [answeredCount,setAnsweredCount] = useState(0);
  const reduceMotion = useReducedMotion();
  const { auth } = useGameState();
  const { attempt, begin: beginRanking } = useRankedAttempt();
  const [rankedMs, setRankedMs] = useState(1);
  const [runUserId, setRunUserId] = useState<string | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<{ answers: VocabAnswer[]; correctCount: number }>({ answers: [], correctCount: 0 });
  const answersRef = useRef<VocabAnswer[]>([]);
  const correctCountRef = useRef(0);

  const [phase, setPhase] = useState<Phase>("ready");
  const [stage, setStage] = useState<Stage>("drive");
  const [round, setRound] = useState<Round | null>(null);
  const [lane, setLane] = useState(1);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [lives, setLives] = useState(START_LIVES);
  const [lastResult, setLastResult] = useState<LastResult | null>(null);
  const [missed, setMissed] = useState<VocabItem[]>([]);
  const [burst, setBurst] = useState(0);

  // 타이머 콜백에서 최신 값을 읽어야 하는 것들은 ref 로도 들고 있는다.
  const laneRef = useRef(1);
  const livesRef = useRef(START_LIVES);
  const comboRef = useRef(0);
  const deckRef = useRef<VocabItem[]>([]);
  const deckIndexRef = useRef(0);
  const roundKeyRef = useRef(0);

  const { outcome, complete: completeRun, reset: resetRun } = useGameOutcome("cab", difficulty);
  useGameLoop("cab", phase === "over" ? "ended" : phase === "running" ? paused ? "paused" : "running" : "idle");
  const fever = combo >= FEVER_AT;
  const roundMs = cabDuration(difficulty, answeredCount, fever);

  /** 덱에서 다음 단어를 꺼내 라운드를 만든다. 덱이 바닥나면 다시 섞는다. */
  const deal = useCallback(() => {
    if (deckIndexRef.current >= deckRef.current.length) {
      deckRef.current = shuffledDeck();
      deckIndexRef.current = 0;
    }
    const item = deckRef.current[deckIndexRef.current];
    deckIndexRef.current += 1;

    const { lanes, correctLane } = buildLanes(item);
    roundKeyRef.current += 1;

    laneRef.current = 1;
    setLane(1);
    setRound({ key: roundKeyRef.current, item, lanes, correctLane });
    setLastResult(null);
    roundClock.current = 0; feedbackClock.current = 0; setElapsed(0);
    setStage("drive");
  }, []);

  const startGame = useCallback(() => {
    setPaused(false); runClock.current = 0; beginLearning(); setAnsweredCount(0); setCorrectTotal(0); beginRanking(); setRankedMs(1);
    resetRun();
    fieldRef.current?.focus();
    setRunUserId(auth.status === "signed-in" ? auth.userId : null);
    answersRef.current = [];
    correctCountRef.current = 0;
    deckRef.current = shuffledDeck();
    deckIndexRef.current = 0;
    livesRef.current = START_LIVES;
    comboRef.current = 0;

    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setLives(START_LIVES);
    setMissed([]);
    setPhase("running");
    deal();
  }, [deal, auth, resetRun, beginRanking, beginLearning, setPaused]);

  const moveTo = useCallback(
    (next: number) => {
      if (phase !== "running" || stage !== "drive" || paused) return;
      const clamped = Math.max(0, Math.min(2, next));
      laneRef.current = clamped;
      setLane(clamped);
    },
    [phase, stage, paused],
  );

  // 정지·탭 숨김 구간은 판정, 피드백, 순위 시간에 더하지 않습니다.
  useArcadeTicker(phase === "running", paused, delta => {
    runClock.current += delta;
    if (stage === "drive" && round) {
      roundClock.current += delta;
      setElapsed(Math.min(roundMs, roundClock.current));
      if (roundClock.current < roundMs) return;
      const chosenLane = laneRef.current;
      const correct = chosenLane === round.correctLane;
      gameCue(correct ? "correct" : "miss");
      answersRef.current.push({ prompt: round.item.word, correct_answer: round.item.synonym, chosen: round.lanes[chosenLane], was_correct: correct });

      setAnsweredCount(count=>count+1);
      if (correct) {
        learnCorrect(round.item.word);
        correctCountRef.current += 1; setCorrectTotal(correctCountRef.current);
        if(correctCountRef.current % 10 === 0) clearStage(correctCountRef.current / 10);
        const nextCombo = comboRef.current + 1;
        comboRef.current = nextCombo;
        // 콤보가 쌓일수록 점수가 커지고, 피버 중에는 두 배
        const gained = Math.round(100 * (1 + nextCombo * 0.1) * (nextCombo >= FEVER_AT ? 2 : 1));
        setCombo(nextCombo);
        setBestCombo((best) => Math.max(best, nextCombo));
        setScore((prev) => prev + gained);
        setBurst((n) => n + 1);
      } else {
        comboRef.current = 0;
        livesRef.current -= 1;
        setCombo(0);
        setLives(livesRef.current);
        setMissed((prev) => (prev.some((m) => m.word === round.item.word) ? prev : [...prev, round.item]));
      }

      setLastResult({ correct, item: round.item, chosen: round.lanes[chosenLane] });
      setStage("judge");
      feedbackClock.current = 0;
    } else if (stage === "judge") {
      feedbackClock.current += delta;
      if (feedbackClock.current < FEEDBACK_MS) return;
      if (livesRef.current <= 0) {
        setRankedMs(Math.max(1, runClock.current));
        setSummary({ answers: [...answersRef.current], correctCount: correctCountRef.current });
        completeRun(score, correctCountRef.current >= 10); setPhase("over");
      } else deal();
    }
  }, () => setPaused(true));

  // 키보드 조작. 창을 닫으면 언마운트되면서 리스너가 정리된다.
  useEffect(() => {
    if (phase !== "running") return;

    const onKey = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === "arrowleft" || key === "a") {
        event.preventDefault();
        moveTo(laneRef.current - 1);
      } else if (key === "arrowright" || key === "d") {
        event.preventDefault();
        moveTo(laneRef.current + 1);
      }
    };

    const field = fieldRef.current;
    field?.addEventListener("keydown", onKey);
    return () => field?.removeEventListener("keydown", onKey);
  }, [phase, moveTo]);

  return (
    <div ref={fieldRef} tabIndex={0} aria-label="택시 게임 조작 영역" data-paused={paused} className="cab-game arcade-art-game relative overflow-hidden rounded-2xl outline-offset-2">
      <div className="relative min-h-[460px]">
        <div className="cab-illustration" aria-hidden="true"/>

        {/* 전체 바 대신 독립된 상태 배지를 배경 위에 배치합니다. */}
        <GameHud className="cab-stats" label="택시 상태">
          <span className="cab-stage-label">STAGE {Math.floor(correctTotal/10)+1} · {Math.round(3000/roundMs*100)}% 속도</span>
          <span className="font-mono text-sm font-semibold tabular-nums">{score.toLocaleString("ko-KR")}점</span>
          <span style={{ color: "var(--os-ink-dim)" }}>
            콤보 <strong className="font-mono tabular-nums">{combo}</strong>
          </span>
          <span className="flex items-center gap-1" aria-label={`남은 기회 ${lives}개`}>
            {Array.from({ length: START_LIVES }, (_, i) => (
              <Heart
                key={i}
                className={cn("h-3.5 w-3.5", i < lives ? "fill-current text-[#ff5f57]" : "text-white/20")}
                aria-hidden
              />
            ))}
          </span>
          {fever && phase === "running" ? (
            <span className="flex items-center gap-1 rounded-full bg-[#F5C518] px-2 py-0.5 font-bold text-black">
              <Zap className="h-3 w-3" aria-hidden /> 피버 ×2
            </span>
          ) : null}
        </GameHud>

        {paused && phase === "running" ? <div className="arcade-pause-notice" role="status">잠깐 쉬는 중 · 우측 상단 재생 버튼을 눌러주세요</div> : null}
        {phase === "ready" ? (
          <IntroPanel difficulty={difficulty} onStart={startGame} checkingSession={auth.status === "loading"} />
        ) : phase === "over" ? (
          <GameOverPanel
            celebration={<GameOutcome outcome={outcome}/>}
            attempt={attempt} difficulty={difficulty} elapsedMs={rankedMs}
            score={score}
            bestCombo={bestCombo}
            missed={missed}
            userId={runUserId}
            correctCount={summary.correctCount}
            answers={summary.answers}
            onRestart={startGame}
          />
        ) : (
          <PlayField
            round={round}
            lane={lane}
            stage={stage}
            roundMs={roundMs}
            elapsed={elapsed}
            paused={paused}
            fever={fever}
            reduceMotion={Boolean(reduceMotion)}
            lastResult={lastResult}
            burst={burst}
            onPick={moveTo}
          />
        )}
      </div>
    </div>
  );
}

function IntroPanel({ onStart, checkingSession, difficulty }: { onStart: () => void; checkingSession: boolean; difficulty: number }) {
  return (
    <div className="cab-intro relative px-6 py-10 text-center">
      <p className="text-[11px] font-medium tracking-[0.2em] uppercase" style={{ color: "var(--os-accent)" }}>
        타임스스퀘어
      </p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight">옐로캡 러시</h3>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed" style={{ color: "var(--os-ink-dim)" }}>
        위에 뜨는 토플 단어와 <strong>가장 가까운 뜻</strong>이 적힌 차선으로 택시를 옮기세요. 제한 시간은 난이도에 따라 {[3, 2.4, 1.95][difficulty]}초,
        연속으로 맞히면 피버 타임에 들어가 점수가 두 배가 됩니다.
      </p>

      <div
        className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-xs"
        style={{ background: "var(--os-glass)", color: "var(--os-ink-dim)" }}
      >
        <Keyboard className="h-4 w-4" aria-hidden />
        <span>← → 또는 A·D 키, 차선을 직접 눌러도 됩니다</span>
      </div>

      <button
        type="button"
        onClick={onStart}
        disabled={checkingSession}
        className="mt-6 rounded-xl bg-[#F5C518] px-6 py-3 text-sm font-bold text-black shadow-lg transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        {checkingSession ? "세션 확인 중..." : "출발하기"}
      </button>

      <p className="mt-5 text-[11px]" style={{ color: "var(--os-ink-dim)" }}>
        로그인한 뒤 시작하면 종료 화면에서 보상과 오답을 저장할 수 있습니다. 연습 판의 점수·콤보는 이 창에서만 유지됩니다.
      </p>
    </div>
  );
}

function PlayField({
  round,
  lane,
  stage,
  roundMs,
  elapsed,
  paused,
  fever,
  reduceMotion,
  lastResult,
  burst,
  onPick,
}: {
  round: Round | null;
  lane: number;
  stage: Stage;
  roundMs: number;
  elapsed: number;
  paused: boolean;
  fever: boolean;
  reduceMotion: boolean;
  lastResult: LastResult | null;
  burst: number;
  onPick: (lane: number) => void;
}) {
  if (!round) return null;

  return (
    <div className={`cab-play relative px-4 pt-4 pb-5 ${fever ? "cab-fever" : ""}`}>
      {/* 출제 단어 */}
      <div className="text-center">
        <p className="text-[11px] tracking-wide" style={{ color: "var(--os-ink-dim)" }}>
          다음 단어의 동의어는?
        </p>
        <p className="mt-1 text-3xl font-semibold tracking-tight">{round.item.word}</p>
      </div>

      {/* 남은 시간. 애니메이션이 꺼져도 숫자 판정에는 영향이 없다. */}
      <div className="mx-auto mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-white/15">
        <div className="h-full rounded-full" role="progressbar" aria-label="택시 판단 남은 시간" aria-valuemin={0} aria-valuemax={roundMs} aria-valuenow={Math.max(0,roundMs-elapsed)} style={{ width: `${Math.max(0,1-elapsed/roundMs)*100}%`, background: fever ? "#F5C518" : "var(--os-accent-soft)" }}/>

      </div>

      <div className="cab-race-world" aria-label="맨해튼 도로">
        <div className="cab-lanes">
          {round.lanes.map((candidate,index)=><button key={`${round.key}-${index}`} type="button" disabled={paused} onClick={()=>onPick(index)} aria-label={`${index+1}번 차선: ${candidate}`} aria-pressed={lane===index} className={`cab-road-lane ${lane===index ? "lane-selected" : ""} ${stage==="judge" && index===round.correctLane ? "lane-correct" : ""} ${stage==="judge" && lane===index && index!==round.correctLane ? "lane-wrong" : ""}`}><span className="cab-word-sign"><small>{index+1}번 차선</small><strong>{candidate}</strong></span></button>)}
        </div>
        <motion.span initial={false} className="cab-player" aria-hidden="true" animate={{left:`${(lane+.5)*100/3}%`}} transition={reduceMotion ? {duration:0} : {type:"spring",stiffness:420,damping:30}}><span className="cab-shadow"/><span className="cab-car-sprite"/><span className="cab-exhaust"/></motion.span>
        {stage==="judge" && lastResult ? <ArcadeEffects kind={lastResult.correct ? "success" : "miss"} eventKey={burst}/> : null}
        {fever ? <div className="cab-fever-glow" aria-hidden="true"/> : null}
      </div>

      {/* 채점 결과 */}
      <div aria-live="polite" className="mt-3 min-h-[40px] text-center text-sm">
        {stage === "judge" && lastResult ? (
          lastResult.correct ? (
            <p className="font-medium text-[#7ee08a]">
              정답! <strong>{lastResult.item.word}</strong> = {lastResult.item.synonym} ({lastResult.item.meaning})
            </p>
          ) : (
            <p className="font-medium text-[#ffb4b0]">
              아쉽습니다. <strong>{lastResult.item.word}</strong> 의 동의어는{" "}
              <strong>{lastResult.item.synonym}</strong> ({lastResult.item.meaning}) 입니다.
            </p>
          )
        ) : null}
      </div>
    </div>
  );
}

function GameOverPanel({
  celebration,
  attempt, difficulty, elapsedMs,
  score,
  bestCombo,
  missed,
  onRestart,
  userId,
  correctCount,
  answers,
}: {
  celebration: ReactNode;
  attempt: RankedAttempt | null; difficulty: number; elapsedMs: number;
  score: number;
  bestCombo: number;
  missed: VocabItem[];
  onRestart: () => void;
  userId: string | null;
  correctCount: number;
  answers: VocabAnswer[];
}) {
  const [saving, setSaving] = useState(false);
  return (
    <div className="cab-result relative px-6 py-8 text-center">
      <header className="cab-end-heading"><h3 className="text-xl font-semibold tracking-tight">운행 종료</h3><p>{score.toLocaleString("ko-KR")}점 · 최고 콤보 {bestCombo}</p></header>
      {celebration}

      {missed.length > 0 ? (
        <div className="cab-review mx-auto mt-6 max-w-md text-left">
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--os-ink-dim)" }}>
            놓친 단어 {missed.length}개 — 복습하세요
          </p>
          <ResultPages pageSize={1} label="놓친 단어 복습" items={missed.map((item) => (
              <li
                key={item.word}
                className="flex flex-wrap items-baseline gap-x-2 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--os-glass)" }}
              >
                <strong>{item.word}</strong>
                <span style={{ color: "var(--os-accent-soft)" }}>= {item.synonym}</span>
                <span className="text-xs" style={{ color: "var(--os-ink-dim)" }}>
                  {item.meaning}
                </span>
              </li>
            ))}/>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onRestart}
        disabled={saving}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#F5C518] px-5 py-2.5 text-sm font-bold text-black transition-transform hover:scale-[1.03] active:scale-[0.98]"
      >
        <RotateCcw className="h-4 w-4" aria-hidden />
        다시 달리기
      </button>

      <ShareScore game="옐로캡 러시" score={score}/>
      <RankedRecordSave key={attempt?.runId ?? "guest"} attempt={attempt} game="cab" difficulty={difficulty} score={score} elapsedMs={elapsedMs}/>
      <GameResultSave userId={userId} score={score} correctCount={correctCount} answers={answers} onBusy={setSaving} />
    </div>
  );
}
