"use client";

import { useRef, useState } from "react";
import { shuffledDeck, type VocabItem } from "@/lib/vocab";
import { clearPop, freshPopBoard, popLegalMove, popMatches, swapPop, type PopBoard, type PopStep } from "@/lib/word-pop";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { useArcadeTicker } from "./useArcadeTicker";
import { GameOutcome } from "./GameOutcome";
import { ShareScore } from "./ShareScore";

type Run = { score: number; missions: number; target: number; progress: number; chain: number };
const fresh = (): Run => ({ score: 0, missions: 0, target: 0, progress: 0, chain: 0 });
export function WordPop({ difficulty = 0 }: { difficulty?: number }) {
  const [phase, setPhase] = useState<"ready" | "play" | "clear" | "over">("ready");
  const [board, setBoard] = useState<PopBoard>([]); const boardRef = useRef<PopBoard>([]);
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [run, setRun] = useState(fresh); const runRef = useRef(fresh());
  const [remaining, setRemaining] = useState(60_000); const time = useRef(60_000);
  const [paused, setPaused] = useState(false); const [message, setMessage] = useState("");
  const [cleared, setCleared] = useState<number[]>([]); const pending = useRef<PopBoard>([]); const delay = useRef(0);
  const presentation = useGameOutcome("pop", difficulty);
  const pointer = useRef({ index: -1, x: 0, y: 0, until: 0 });
  const busy = useRef(false);
  const goal = 3 + difficulty;
  useGameLoop("pop", phase === "over" ? "ended" : paused ? "paused" : phase === "ready" ? "idle" : "running");
  function start() {
    busy.current = false; presentation.reset(); const next = freshPopBoard(); boardRef.current = next; setBoard(next);
    setWords(shuffledDeck().slice(0, 6)); runRef.current = fresh(); setRun(fresh()); time.current = 60_000; setRemaining(60_000);
    setPaused(false); setSelected(null); setMessage("두 블록을 차례로 누르거나 밀어서 바꿔보세요."); setPhase("play"); setCleared([]);
  }
  function apply(step: PopStep, chain: number) {
    busy.current = true;
    const before = runRef.current;
    const progress = before.progress + step.counts[before.target];
    const done = progress >= goal;
    const next = { score: before.score + step.cleared.length * 40 * chain + (done ? 300 : 0), missions: before.missions + (done ? 1 : 0), target: done ? (before.target + 1) % 6 : before.target, progress: done ? 0 : progress, chain };
    runRef.current = next; setRun(next); pending.current = step.board; setCleared(step.cleared); delay.current = 0; setPhase("clear"); setSelected(null);
    setMessage(`${chain > 1 ? `${chain}연쇄! ` : "팝! "}${done ? "한국어 미션 성공 +300 · " : ""}${step.special === "row" ? "줄 폭탄 생성!" : step.special === "star" ? "별 폭탄 생성!" : `${step.cleared.length}개 터졌어요`}`);
    gameCue(done ? "correct" : "pop");
  }
  function swap(a: number, b: number) {
    if (paused || phase !== "play" || busy.current) return;
    const step = swapPop(boardRef.current, a, b);
    if (!step) { setSelected(null); setMessage("이웃한 블록을 바꿔 같은 단어 3개를 만들어보세요."); return; }
    apply(step, 1);
  }
  function choose(index: number) {
    if (paused || phase !== "play" || busy.current) return;
    if (selected === null) setSelected(index);
    else if (selected === index) setSelected(null);
    else if (Math.abs(Math.floor(selected / 7) - Math.floor(index / 7)) + Math.abs(selected % 7 - index % 7) === 1) swap(selected, index);
    else setSelected(index);
  }
  useArcadeTicker(phase === "play" || phase === "clear", paused, delta => {
    time.current = Math.max(0, time.current - delta); setRemaining(time.current);
    if (!time.current) { presentation.complete(runRef.current.score, runRef.current.missions >= 5 || runRef.current.score >= 3000); setPhase("over"); return; }
    if (phase !== "clear") return;
    delay.current += delta;
    if (delay.current < 420) return;
    boardRef.current = pending.current; setBoard(pending.current); setCleared([]);
    const groups = popMatches(pending.current);
    if (groups.length && runRef.current.chain < 12) apply(clearPop(pending.current, groups), runRef.current.chain + 1);
    else {
      if (groups.length || !popLegalMove(pending.current)) { const next = freshPopBoard(); boardRef.current = next; setBoard(next); setMessage("새 조합이 열리도록 보드를 재정렬했어요."); }
      busy.current = false; setPhase("play");
    }
  }, () => setPaused(true));
  return <section className="word-pop arcade-art-game" aria-label="워드 팝 게임" data-paused={paused}>
    <header className="pop-hud"><h2>워드 팝</h2><strong aria-label="워드 팝 점수">{run.score}점</strong><span aria-label="워드 팝 남은 시간">{Math.ceil(remaining / 1000)}초</span></header>
    {phase === "ready" ? <div className="pop-intro"><span aria-hidden="true">🫧</span><h3>단어를 맞추고, 팡!</h3><p>7×7 보드에서 이웃한 블록을 바꿔<br/>같은 영단어 3개를 가로·세로로 이으세요.</p><p>위의 한국어 뜻에 맞는 단어를 {goal}개 터뜨리면 +300점!<br/>4개는 줄 폭탄, 5개는 같은 단어를 전부 터뜨리는 별 폭탄.<br/>폭탄은 이웃 블록과 바꾸면 바로 터집니다.</p><p>60초 · 클릭 두 번 / 터치 밀기 · 연쇄일수록 점수 증가</p><button className="word-primary" onClick={start}>워드 팝 시작</button></div> : phase === "over" ? <div className="pop-result"><GameOutcome outcome={presentation.outcome}/><h3>오늘의 팝 타임 끝!</h3><p>{run.score}점 · 한국어 미션 {run.missions}개 성공</p><ShareScore game="워드 팝" score={run.score}/><button className="word-primary" onClick={start}>다시 팝!</button></div> : <>
      <div className="pop-mission"><span>이 뜻의 단어를 터뜨려요</span><strong>{words[run.target]?.meaning}</strong><small>{run.progress}/{goal}개 · 미션 {run.missions}개 성공</small><button onClick={() => setPaused(!paused)}>{paused ? "계속 팝" : "일시정지"}</button></div>
      <div className="pop-board-wrap"><div className="pop-board" aria-label="단어 퍼즐 보드">
        {board.map((tile, index) => <button key={index} className={`pop-tile tile-${tile.kind} ${selected === index ? "tile-selected" : ""} ${cleared.includes(index) ? "tile-burst" : ""}`} disabled={paused || phase !== "play"} aria-label={`${Math.floor(index / 7) + 1}행 ${index % 7 + 1}열 ${words[tile.kind]?.word}${tile.special ? tile.special === "row" ? " 줄 폭탄" : " 별 폭탄" : ""}`} aria-pressed={selected === index} onClick={() => { if (Date.now() >= pointer.current.until) choose(index); }} onPointerDown={e => { pointer.current = { index, x: e.clientX, y: e.clientY, until: 0 }; }} onPointerUp={e => {
          const from = pointer.current; const dx = e.clientX - from.x; const dy = e.clientY - from.y;
          if (from.index !== index || Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
          const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : -1 : dy > 0 ? 7 : -7;
          pointer.current.until = Date.now() + 300; swap(index, index + direction);
        }}><span>{["✦", "●", "◆", "♥", "✿", "⬟"][tile.kind]}</span><strong>{words[tile.kind]?.word}</strong>{tile.special ? <i>{tile.special === "row" ? "↔" : "★"}</i> : null}</button>)}
      </div>{paused ? <div className="word-pause">잠깐 쉬는 중 · 계속 팝을 눌러주세요</div> : null}</div>
      <p className="pop-message" role="status">{message}</p><div className="pop-word-key">{words.map((word, i) => <span key={word.word} className={`key-${i}`}><b>{word.word}</b> {word.meaning}</span>)}</div>
    </>}
    <p className="word-note">연습 점수입니다. 코인·원격 기록에 자동 저장하지 않습니다.</p>
  </section>;
}
