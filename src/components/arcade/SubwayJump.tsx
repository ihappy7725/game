"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { shuffledDeck, type VocabItem } from "@/lib/vocab";
import { subwayDuration, wordChoices } from "@/lib/word-arcade";
import { useArcadeTicker } from "./useArcadeTicker";
import { ArcadeRunner } from "./ArcadeRunner";
import { ArcadeEffects } from "./ArcadeEffects";
import { ShareScore } from "./ShareScore";

type Round = { item: VocabItem; choices: string[]; correct: number; duration: number };
type Run = { score: number; cleared: number; attempts: number; combo: number; best: number; hearts: number };

export function SubwayJump({ difficulty = 0 }: { difficulty?: number }) {
  const fresh = (): Run => ({ score: 0, cleared: 0, attempts: 0, combo: 0, best: 0, hearts: [3, 3, 2][difficulty] });
  const [phase, setPhase] = useState<"ready" | "run" | "jump" | "fall" | "land" | "over">("ready");
  const [round, setRound] = useState<Round | null>(null);
  const [run, setRun] = useState(fresh);
  const runRef = useRef(fresh());
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef(0);
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [landedCorrect, setLandedCorrect] = useState(false);
  const deck = useRef<VocabItem[]>([]);
  const cursor = useRef(0);
  const settled = useRef(false);
  const landing = useRef({ correct: false, quick: false });

  function deal() {
    if (cursor.current >= deck.current.length) { deck.current = shuffledDeck(); cursor.current = 0; }
    const item = deck.current[cursor.current++];
    setRound({ item, ...wordChoices(item, 3), duration: subwayDuration(difficulty, runRef.current.attempts) });
    clock.current = 0; setElapsed(0); settled.current = false; setSelected(null); setPhase("run");
  }
  function start() { runRef.current = fresh(); setRun(fresh()); deck.current = shuffledDeck(); cursor.current = 0; setPaused(false); setMessage(""); deal(); }
  function hop(index: number | null) {
    if (phase !== "run" || !round || paused || settled.current) return;
    settled.current = true;
    landing.current = { correct: index === round.correct, quick: clock.current < round.duration * .5 };
    setSelected(index); clock.current = 0; setPhase(index === null ? "fall" : "jump");
  }
  function land() {
    if (!round) return;
    const { correct, quick } = landing.current;
    setLandedCorrect(correct);
    const before = runRef.current;
    const combo = correct ? before.combo + 1 : 0;
    const gained = correct ? 100 + combo * 20 + (quick ? 50 : 0) : 0;
    const bonus = correct && combo % 5 === 0;
    const next = { score: before.score + gained, cleared: before.cleared + (correct ? 1 : 0), attempts: before.attempts + 1, combo, best: Math.max(before.best, combo), hearts: Math.min([3, 3, 2][difficulty], before.hearts - (correct ? 0 : 1) + (bonus ? 1 : 0)) };
    runRef.current = next; setRun(next); clock.current = 0;
    setMessage(correct ? `${bonus ? "구급 키트! 기회 +1 · " : ""}${quick ? "빠른 점프! " : "착지 성공! "}+${gained}` : `${selected === null ? "발판을 놓쳤어요!" : "가짜 발판이 무너졌어요!"} ${round.item.meaning} → ${round.item.word}`);
    setPhase("land");
  }
  useArcadeTicker(["run", "jump", "fall", "land"].includes(phase), paused, delta => {
    clock.current += delta;
    if (phase === "run" && round) { setElapsed(Math.min(clock.current, round.duration)); if (clock.current >= round.duration) hop(null); }
    else if ((phase === "jump" || phase === "fall") && clock.current >= 620) land();
    else if (phase === "land" && clock.current >= 680) { if (runRef.current.hearts <= 0 || runRef.current.attempts >= 24) setPhase("over"); else deal(); }
  }, () => setPaused(true));
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (["1", "2", "3", "ArrowUp", "ArrowRight", "ArrowDown"].includes(e.key)) { e.preventDefault(); if (!e.repeat) hop(["1", "ArrowUp"].includes(e.key) ? 0 : ["2", "ArrowRight"].includes(e.key) ? 1 : 2); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  });
  const progress = round ? elapsed / round.duration : 0;
  return <section className="word-action subway-game arcade-art-game" aria-label="서브웨이 점프 게임" data-paused={paused}>
    <header className="word-hud"><div><small>도시 위를 잇는 단어 점프</small><h2>서브웨이 점프</h2></div><div aria-label="서브웨이 기록"><strong>{run.score}점</strong><span>착지 {run.cleared} · 연속 {run.combo}</span></div><div className="jump-hearts" aria-label={`점프 기회 ${run.hearts}`}><span aria-hidden>{"♥".repeat(run.hearts)}</span><small>{run.attempts}/24 발판</small></div></header>
    {phase === "ready" ? <div className="word-intro"><span className="word-game-badge">↗</span><h3>발판이 사라지기 전에, 점프!</h3><p>위에 뜬 한국어 뜻과 맞는 영단어 발판을 누르세요.<br/>정답 발판은 안전하게 착지, 오답 발판은 무너집니다.</p><p>빠르게 뛰면 +50점 · 연속 5번 착지하면 기회 +1<br/>총 24발판, 점프 기회 {fresh().hearts}번</p><p className="word-note">1·2·3 / ↑·→·↓ 또는 발판 터치 · 제한 시간 {subwayDuration(difficulty, 0) / 1000}초</p><button className="word-primary" onClick={start}>서브웨이 출발</button></div> : phase === "over" ? <div className="word-intro" aria-label="서브웨이 결과"><span className="word-game-badge">✦</span><h3>{run.hearts > 0 ? "유니온 역에 도착했어요!" : "다음 열차에서 다시 만나요"}</h3><p>{run.score}점 · 착지 {run.cleared}/{run.attempts} · 최고 연속 {run.best}</p><p>{message}</p><ShareScore game="서브웨이 점프" score={run.score}/><button className="word-primary" onClick={start}>다시 출발</button></div> : <>
      <div className="word-question"><span>이 뜻의 발판으로 점프</span><strong aria-label="서브웨이 한국어 뜻">{round?.item.meaning}</strong><button onClick={() => setPaused(!paused)}>{paused ? "계속 점프" : "일시정지"}</button></div>
      <div className={`subway-world word-world phase-${phase} ${phase === "land" && !landedCorrect ? "bad-landing" : ""}`} aria-label="서브웨이 전장">
        <div className="subway-city art-landscape" aria-hidden="true"/><div className="subway-air" aria-hidden="true"/><div className="subway-rails" aria-hidden="true"/>
        <div className="subway-train"><span/><span/><span/><span/><span/><span/></div>
        <div className="subway-home-platform"/>
        <div key={`${run.attempts}:${selected}:${phase === "run"}`} className={`subway-runner ${phase === "jump" ? "is-jumping" : phase === "fall" ? "is-falling" : ""}`} style={{ "--landing-y": `${70 - (selected ?? 1) * 20}%` } as CSSProperties}><ArcadeRunner running={phase === "run" && !paused} airborne={phase === "jump"}/></div>
        <div className="subway-speed" aria-hidden/>
        {round?.choices.map((word, i) => <button key={word} aria-label={`${i + 1}번 발판: ${word}`} className={`word-platform platform-${i} ${selected === i ? "platform-picked" : ""} ${phase === "land" && selected === i && !landedCorrect ? "platform-broken" : ""}`} disabled={paused || phase !== "run"} onClick={() => hop(i)}><small>{i + 1} {i === 0 ? "↑" : i === 1 ? "→" : "↓"}</small><strong>{word}</strong><span style={{ width: `${100 - progress * 100}%` }}/></button>)}
        <p className="subway-station">유니온 역까지 {24 - run.attempts} 발판</p>
        {phase === "land" ? <p className="word-feedback" role="status">{message}</p> : null}
        {phase === "land" ? <ArcadeEffects kind={landedCorrect ? "success" : "miss"} eventKey={run.attempts}/> : null}
        {paused ? <div className="word-pause">일시정지 · 계속 점프를 눌러주세요</div> : null}
      </div>
      <div className="word-time"><span style={{ width: `${100 - progress * 100}%` }}/></div>
      <p className="subway-guide">1 / ↑ 위 발판 · 2 / → 가운데 · 3 / ↓ 아래 발판 · 누르면 바로 점프</p>
    </>}
    <p className="word-note">이번 판의 연습 점수입니다. 코인·원격 기록에 자동 저장하지 않습니다.</p>
  </section>;
}
