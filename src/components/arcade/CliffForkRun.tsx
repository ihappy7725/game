"use client";

import { useEffect, useRef, useState } from "react";
import { shuffledDeck, type VocabItem } from "@/lib/vocab";
import { forkDuration, forkEnergy, wordChoices } from "@/lib/word-arcade";
import { useArcadeTicker } from "./useArcadeTicker";
import { ArcadeRunner } from "./ArcadeRunner";
import { ArcadeEffects } from "./ArcadeEffects";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { GameOutcome } from "./GameOutcome";
import { RunningWorld } from "./RunningWorld";
import { ShareScore } from "./ShareScore";

type Round = { item: VocabItem; choices: string[]; correct: number; duration: number; rock: boolean; supply: boolean };
type Run = { score: number; cleared: number; energy: number; combo: number };
const initial = (): Run => ({ score: 0, cleared: 0, energy: 100, combo: 0 });

export function CliffForkRun({ difficulty = 0 }: { difficulty?: number }) {
  const [phase, setPhase] = useState<"ready" | "run" | "cross" | "fall" | "over">("ready");
  const [round, setRound] = useState<Round | null>(null);
  const [run, setRun] = useState(initial);
  const runRef = useRef(initial());
  const [selected, setSelected] = useState<number | null>(null);
  const selection = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef(0);
  const [paused, setPaused] = useState(false);
  const [jumped, setJumped] = useState(false);
  const jump = useRef(false);
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
    setRound({ item, ...wordChoices(item, 2), duration: forkDuration(difficulty, n - 1), rock: n % 4 === 0, supply: n % 3 === 0 });
    selection.current = null; setSelected(null); jump.current = false; setJumped(false);
    clock.current = 0; setElapsed(0); settled.current = false; setPhase("run");
  }
  function start() { presentation.reset(); runRef.current = initial(); setRun(initial()); deck.current = shuffledDeck(); cursor.current = 0; setPaused(false); setMessage(""); deal(); }
  function choose(lane: number) { if (phase !== "run" || paused || settled.current) return; selection.current = lane; setSelected(lane); }
  function leap() { if (phase !== "run" || paused || !round?.rock || clock.current < round.duration * .3 || jump.current) return; jump.current = true; setJumped(true); gameCue("jump"); }
  function resolve() {
    if (!round || settled.current) return;
    settled.current = true;
    const correct = selection.current === round.correct;
    gameCue(correct ? "correct" : "miss");
    const previous = runRef.current;
    const energy = forkEnergy(previous.energy, round.duration, correct && round.supply, correct && round.rock, jump.current);
    const next = { score: previous.score + (correct ? 100 + previous.combo * 15 : 0), cleared: previous.cleared + (correct ? 1 : 0), energy, combo: correct ? previous.combo + 1 : 0 };
    runRef.current = next; setRun(next); clock.current = 0;
    setMessage(!correct ? `${selection.current === null ? "갈림길을 고르지 못했어요." : "발밑의 길이 무너졌어요!"} ${round.item.meaning} → ${round.item.word}` : energy <= 0 ? "체력이 다했어요. 보급을 챙겨 다시 도전하세요." : `${round.supply ? "보급 획득! 체력 +24 · " : ""}${round.rock ? jump.current ? "낙석 점프 성공! · " : "낙석 충돌! 체력 −22 · " : ""}통과! 연속 ${next.combo}`);
    setPhase(correct && energy > 0 ? "cross" : "fall");
  }
  useArcadeTicker(phase === "run" || phase === "cross" || phase === "fall", paused, delta => {
    clock.current += delta;
    if (phase === "run" && round) { setElapsed(Math.min(clock.current, round.duration)); if (clock.current >= round.duration) resolve(); }
    else if (clock.current >= 780) { if (phase === "fall") { presentation.complete(runRef.current.score, runRef.current.cleared >= 10); setPhase("over"); } else deal(); }
  }, () => setPaused(true));
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D", " "].includes(e.key)) e.preventDefault();
      if (["ArrowLeft", "a", "A"].includes(e.key)) choose(0);
      if (["ArrowRight", "d", "D"].includes(e.key)) choose(1);
      if (e.key === " ") leap();
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  const progress = round ? elapsed / round.duration : 0;
  const energy = phase === "run" ? Math.max(0, run.energy - elapsed / 1000 * 2.2) : run.energy;
  return <section className="word-action cliff-game arcade-art-game" aria-label="갈림길 게임" data-paused={paused}>
    <header className="word-hud"><div><small>단 한 번의 선택, 끝없는 절벽</small><h2>갈림길</h2></div><div aria-label="갈림길 기록"><strong>{run.score}점</strong><span>{run.cleared}개 통과 · 연속 {run.combo}</span></div><div className="stamina"><span>체력 {Math.ceil(energy)}</span><meter aria-label="달리기 체력" min={0} max={100} value={energy}/></div></header>
    {phase === "ready" ? <div className="word-intro"><span className="word-game-badge">↟</span><h3>올바른 단어가 길이 됩니다</h3><p>위에 뜬 한국어 뜻에 맞는 영단어 길을 고르세요.<br/>갈림길에 닿을 때 판정합니다. 오답·시간 초과는 즉시 추락!</p><p>3번째 길마다 체력 보급 · 4번째 길마다 낙석<br/>낙석 알림이 켜지면 스페이스 또는 점프 버튼!</p><p className="word-note">← → / A·D 또는 길 터치 · 체력은 달리는 동안 소모됩니다.</p><p className="word-note">첫 갈림길 {forkDuration(difficulty, 0) / 1000}초</p><button className="word-primary" onClick={start}>절벽 달리기 시작</button></div> : phase === "over" ? <div className="word-intro" aria-label="갈림길 결과"><GameOutcome outcome={presentation.outcome}/><span className="word-game-badge">↯</span><h3>다음 갈림길은 더 멀리</h3><p>{message}</p><p>{run.score}점 · {run.cleared}개 갈림길 통과</p><ShareScore game="갈림길" score={run.score}/><button className="word-primary" onClick={start}>다시 달리기</button></div> : <>
      <div className="word-question"><span>이 뜻의 길을 고르세요</span><strong aria-label="갈림길 한국어 뜻">{round?.item.meaning}</strong><button onClick={() => setPaused(!paused)}>{paused ? "계속 달리기" : "일시정지"}</button></div>
      <div className={`cliff-world word-world phase-${phase}`} aria-label="절벽 전장">
        <RunningWorld scene="fork" running={phase === "run" || phase === "cross"} paused={paused} progress={progress} steering={(selected === null ? 0 : selected === 0 ? -1 : 1) * progress}/>
        {round?.rock ? <div className="trail-rock" aria-hidden="true" style={{ top: `${38 + progress * 35}%` }}><span/></div> : round?.supply ? <div className="trail-pickup" aria-hidden="true" style={{ top: `${38 + progress * 35}%` }}><span>✚</span></div> : null}
        <div className={`cliff-runner ${jumped ? "runner-jumping" : ""}`} style={{ left: `${50 + (selected === null ? 0 : selected === 0 ? -1 : 1) * progress * 17}%` }}><ArcadeRunner facing="back" running={!paused && phase === "run"} airborne={jumped}/></div>
        {round?.choices.map((word, i) => <button key={word} className={`fork-sign fork-${i} ${selected === i ? "chosen" : ""}`} aria-label={`${i === 0 ? "왼쪽" : "오른쪽"} 길: ${word}`} aria-pressed={selected === i} disabled={paused || phase !== "run"} onClick={() => choose(i)}><span>{i === 0 ? "←" : "→"}</span><strong>{word}</strong></button>)}
        {round?.supply ? <div className="trail-event supply-event">✚ 이번 길은 체력 보급</div> : round?.rock ? <div className={`trail-event ${progress >= .3 ? "rock-warning" : ""}`}>{jumped ? "낙석을 뛰어넘었어요!" : progress >= .3 ? "낙석! 지금 점프!" : "앞에 낙석 구간"}</div> : null}
        {phase === "cross" || phase === "fall" ? <p role="status" className="word-feedback">{message}</p> : null}
        {phase === "cross" ? <ArcadeEffects eventKey={run.cleared}/> : phase === "fall" ? <ArcadeEffects kind="miss"/> : null}
        {paused ? <div className="word-pause">일시정지 · 계속 달리기를 눌러주세요</div> : null}
      </div>
      <div className="word-time"><span style={{ width: `${(1 - progress) * 100}%` }}/></div>
      <div className="word-touch"><button disabled={paused || phase !== "run"} onClick={() => choose(0)}>← 왼쪽 길</button><button disabled={paused || phase !== "run" || !round?.rock || progress < .3 || jumped} onClick={leap}>점프 · SPACE</button><button disabled={paused || phase !== "run"} onClick={() => choose(1)}>오른쪽 길 →</button></div>
    </>}
    <p className="word-note">이번 판의 연습 점수입니다. 코인·원격 기록에 자동 저장하지 않습니다.</p>
  </section>;
}
