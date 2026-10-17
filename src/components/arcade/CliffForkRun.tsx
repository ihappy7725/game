"use client";

import { useEffect, useRef, useState } from "react";
import { GameHud } from "./GameHud";
import { useGamePause } from "./GamePause";
import { useGameLearning } from "@/lib/learning-progress";
import { shuffledDeck, type VocabItem } from "@/lib/vocab";
import { forkDuration, forkEnergy, wordChoices } from "@/lib/word-arcade";
import { useArcadeTicker } from "./useArcadeTicker";
import { ForkWorld } from "./ForkWorld";
import { FORK_START, nextFork, type ForkLeg } from "@/lib/fork-world";
import { ArcadeEffects } from "./ArcadeEffects";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { GameOutcome } from "./GameOutcome";
import { useRankedAttempt } from "@/lib/useRankedAttempt";
import { RankedRecordSave } from "./RankedRecordSave";
import { ShareScore } from "./ShareScore";

type Round = { item: VocabItem; choices: string[]; correct: number; duration: number; wind: boolean; supply: boolean };
type Run = { score: number; cleared: number; energy: number; combo: number };
const initial = (): Run => ({ score: 0, cleared: 0, energy: 100, combo: 0 });

export function CliffForkRun({ difficulty = 0 }: { difficulty?: number }) {
  const learning = useGameLearning("fork", difficulty);
  const { attempt, begin: beginRanking } = useRankedAttempt();
  const totalMs = useRef(0); const [rankedMs, setRankedMs] = useState(1);
  const [phase, setPhase] = useState<"ready" | "run" | "cross" | "fall" | "over">("ready");
  const [round, setRound] = useState<Round | null>(null);
  const [run, setRun] = useState(initial);
  const runRef = useRef(initial());
  const [selected, setSelected] = useState<number | null>(null);
  const selection = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef(0);
  const { paused, setPaused } = useGamePause();
  const [origin, setOrigin] = useState(FORK_START);
  const [trail, setTrail] = useState<ForkLeg[]>([]);
  const [transition, setTransition] = useState(0);
  const [message, setMessage] = useState("");
  const deck = useRef<VocabItem[]>([]);
  const cursor = useRef(0);
  const settled = useRef(false);
  const presentation = useGameOutcome("fork", difficulty);
  useGameLoop("fork", phase === "over" ? "ended" : paused ? "paused" : phase === "ready" ? "idle" : "running");

  function deal() {
    if (cursor.current >= deck.current.length) { deck.current = shuffledDeck(); cursor.current = 0; }
    const item = deck.current[cursor.current++];
    const n = runRef.current.cleared + 1;
    setRound({ item, ...wordChoices(item, 2), duration: forkDuration(difficulty, n - 1), wind: n % 4 === 0, supply: n % 3 === 0 });
    selection.current = null; setSelected(null); setTransition(0);
    clock.current = 0; setElapsed(0); settled.current = false; setPhase("run");
  }
  function start() { learning.begin(); setOrigin(FORK_START); setTrail([]); beginRanking(); totalMs.current = 0; setRankedMs(1); presentation.reset(); runRef.current = initial(); setRun(initial()); deck.current = shuffledDeck(); cursor.current = 0; setPaused(false); setMessage(""); deal(); }
  function choose(lane: number) { if (phase !== "run" || paused || settled.current) return; selection.current = lane; setSelected(lane); }
  function resolve() {
    if (!round || settled.current) return;
    settled.current = true;
    const correct = selection.current === round.correct;
    gameCue(correct ? "correct" : "miss");
    if (correct) learning.correct(round.item.word);
    const previous = runRef.current;
    const energy = forkEnergy(previous.energy, round.duration, correct && round.supply, correct && round.wind);
    const next = { score: previous.score + (correct ? 100 + previous.combo * 15 : 0), cleared: previous.cleared + (correct ? 1 : 0), energy, combo: correct ? previous.combo + 1 : 0 };
    if(correct && next.cleared % 10 === 0) learning.milestone(next.cleared / 10);
    runRef.current = next; setRun(next); clock.current = 0; setTransition(0);
    setMessage(!correct ? `${selection.current === null ? "갈림길을 고르지 못했어요." : "발밑의 길이 무너졌어요!"} ${round.item.meaning} → ${round.item.word}` : energy <= 0 ? "체력이 다했어요. 보급을 챙겨 다시 도전하세요." : `${round.supply ? "보급 획득! 체력 +24 · " : ""}${round.wind ? "맞바람! 체력 −12 · " : ""}통과! 연속 ${next.combo}`);
    setPhase(correct && energy > 0 ? "cross" : "fall");
  }
  useArcadeTicker(phase === "run" || phase === "cross" || phase === "fall", paused, delta => {
    clock.current += delta; totalMs.current += delta;
    if (phase === "run" && round) { setElapsed(Math.min(clock.current, round.duration)); if (clock.current >= round.duration) resolve(); }
    else { setTransition(Math.min(1, clock.current / 780)); if (clock.current >= 780) { if (phase === "fall") { setRankedMs(totalMs.current); presentation.complete(runRef.current.score, runRef.current.cleared >= 10); setPhase("over"); } else { const choice = selection.current ?? 0; setTrail(previous => [...previous, { origin, choice }].slice(-3)); setOrigin(nextFork(origin, choice)); deal(); } } }
  }, () => setPaused(true));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(e.key)) e.preventDefault();
      if (["ArrowLeft", "a", "A"].includes(e.key)) choose(0);
      if (["ArrowRight", "d", "D"].includes(e.key)) choose(1);
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  const progress = round ? elapsed / round.duration : 0;
  const energy = phase === "run" ? Math.max(0, run.energy - elapsed / 1000 * 2.2) : run.energy;
  return <section className="word-action cliff-game arcade-art-game" aria-label="갈림길 게임" data-paused={paused}>
    <ForkWorld origin={origin} trail={trail} progress={progress} transition={transition} choice={selected} phase={phase} paused={paused}/>
    <GameHud className="fork-stats" label="갈림길 상태"><div><span>STAGE {Math.floor(run.cleared/10)+1}</span></div><div aria-label="갈림길 기록"><strong>{run.score}점</strong><span>{run.cleared}개 통과 · 연속 {run.combo}</span></div><div className="stamina"><span>체력 {Math.ceil(energy)}</span><meter aria-label="달리기 체력" min={0} max={100} value={energy}/></div></GameHud>
    {phase === "ready" ? <div className="word-intro"><span className="word-game-badge">↟</span><h3>올바른 단어가 길이 됩니다</h3><p>위에 뜬 한국어 뜻에 맞는 영단어 길을 고르세요.<br/>갈림길에 닿을 때 판정합니다. 오답·시간 초과는 즉시 추락!</p><p>3번째 길마다 체력 보급 +24 · 4번째 길마다 맞바람 −12<br/>선택한 길로 방향을 틀면 다음 갈림길이 이어집니다.</p><p className="word-note">← → / A·D 또는 길 터치 · 체력은 달리는 동안 소모됩니다.</p><p className="word-note">첫 갈림길 {forkDuration(difficulty, 0) / 1000}초</p><button className="word-primary" onClick={start}>절벽 달리기 시작</button></div> : phase === "over" ? <div className="word-intro" aria-label="갈림길 결과"><GameOutcome outcome={presentation.outcome}/><span className="word-game-badge">↯</span><h3>다음 갈림길은 더 멀리</h3><p>{message}</p><p>{run.score}점 · {run.cleared}개 갈림길 통과</p><ShareScore game="갈림길" score={run.score}/><RankedRecordSave key={attempt?.runId ?? "guest"} attempt={attempt} game="fork" difficulty={difficulty} score={run.score} elapsedMs={rankedMs}/><button className="word-primary" onClick={start}>다시 달리기</button></div> : <>
      <div className="word-question"><span>이 뜻의 길을 고르세요</span><strong aria-label="갈림길 한국어 뜻">{round?.item.meaning}</strong></div>
      <div className={`cliff-world word-world phase-${phase}`} aria-label="절벽 전장">
        {round?.choices.map((word, i) => <button key={word} className={`fork-sign fork-${i} ${selected === i ? "chosen" : ""}`} aria-label={`${i === 0 ? "왼쪽" : "오른쪽"} 길: ${word}`} aria-pressed={selected === i} disabled={paused || phase !== "run"} onClick={() => choose(i)}><span>{i === 0 ? "←" : "→"}</span><strong>{word}</strong></button>)}
        {round?.supply ? <div className="trail-event supply-event">✚ 이번 길은 체력 보급</div> : round?.wind ? <div className="trail-event">맞바람 구간 · 통과 시 체력 −12</div> : null}
        {phase === "cross" || phase === "fall" ? <p role="status" className="word-feedback">{message}</p> : null}
        {phase === "cross" ? <ArcadeEffects eventKey={run.cleared}/> : phase === "fall" ? <ArcadeEffects kind="miss"/> : null}
        {paused ? <div className="word-pause">일시정지 · 우측 상단 재생 버튼을 눌러주세요</div> : null}
      </div>
      <div className="word-time"><span style={{ width: `${(1 - progress) * 100}%` }}/></div>
      <div className="word-touch"><button disabled={paused || phase !== "run"} onClick={() => choose(0)}>← 왼쪽 길</button><button disabled={paused || phase !== "run"} onClick={() => choose(1)}>오른쪽 길 →</button></div>
    </>}
    <p className="word-note">이번 판의 연습 점수입니다. 코인·원격 기록에 자동 저장하지 않습니다.</p>
  </section>;
}
