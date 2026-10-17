"use client";

import { useRef, useState, type CSSProperties } from "react";
import { ResultPages } from "./ResultPages";
import { GameHud } from "./GameHud";
import { useGamePause } from "./GamePause";
import { useGameLearning } from "@/lib/learning-progress";
import { missionDuration, popAnimationMs } from "@/lib/game-tempo";
import { shuffledDeck, type VocabItem } from "@/lib/vocab";
import { clearPop, freshPopBoard, popLegalMove, popMatches, swapPop, type PopBoard, type PopStep } from "@/lib/word-pop";
import { formatPopTime, parsePopRecords, popStageTarget, POP_RECORD_KEY, rankPopRecords, type PopRecord } from "@/lib/pop-records";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { useArcadeTicker } from "./useArcadeTicker";
import { GameOutcome } from "./GameOutcome";
import { useRankedAttempt } from "@/lib/useRankedAttempt";
import { RankedRecordSave } from "./RankedRecordSave";
import { ShareScore } from "./ShareScore";

type Run = { score: number; missions: number; target: number; progress: number; chain: number };
type Phase = "ready" | "play" | "swap" | "return" | "clear" | "stage" | "over";
type Exchange = { a: number; b: number; original: PopBoard; swapped: PopBoard; step: PopStep | null };
const fresh = (): Run => ({ score: 0, missions: 0, target: 0, progress: 0, chain: 0 });
const adjacent = (a: number, b: number) => a >= 0 && b >= 0 && a < 49 && b < 49 && Math.abs(Math.floor(a / 7) - Math.floor(b / 7)) + Math.abs(a % 7 - b % 7) === 1;

export function WordPop({ difficulty = 0 }: { difficulty?: number }) {
  const learning = useGameLearning("pop", difficulty);
  const vocabulary = useRef<VocabItem[]>([]);
  const replacements = useRef(new Set<number>());
  const missionClock = useRef(0);
  const [missionRemaining,setMissionRemaining] = useState(missionDuration(difficulty,0,1));
  const { attempt, begin: beginRanking } = useRankedAttempt();
  const [phase, setPhase] = useState<Phase>("ready");
  const [board, setBoard] = useState<PopBoard>([]); const boardRef = useRef<PopBoard>([]);
  const [words, setWords] = useState<VocabItem[]>([]);
  const [selected, setSelected] = useState<number | null>(null); const selection = useRef<number | null>(null);
  const [run, setRun] = useState(fresh); const runRef = useRef(fresh());
  const [stage, setStage] = useState(1);
  const [remaining, setRemaining] = useState(60_000); const time = useRef(60_000);
  const { paused, setPaused } = useGamePause(); const [message, setMessage] = useState("");
  const [cleared, setCleared] = useState<number[]>([]); const pending = useRef<PopBoard>([]); const delay = useRef(0);
  const [exchange, setExchange] = useState<Exchange | null>(null); const exchangeRef = useRef<Exchange | null>(null);
  const [fall, setFall] = useState(false); const [hint, setHint] = useState<number[]>([]);
  const [records, setRecords] = useState<PopRecord[]>([]); const [lastRecord, setLastRecord] = useState<PopRecord | null>(null);
  const [recordMessage, setRecordMessage] = useState("");
  const presentation = useGameOutcome("pop", difficulty);
  const pointer = useRef({ index: -1, id: -1, x: 0, y: 0, suppress: false });
  const busy = useRef(false); const finished = useRef(false);
  const goal = 3 + difficulty; const targetScore = popStageTarget(stage, difficulty);
  const playing = !["ready", "stage", "over"].includes(phase);
  useGameLoop("pop", phase === "over" || phase === "stage" ? "ended" : paused ? "paused" : phase === "ready" ? "idle" : "running");
  function select(index: number | null) { selection.current = index; setSelected(index); }
  function start(nextStage = 1) {
    learning.begin(); missionClock.current=0; setMissionRemaining(missionDuration(difficulty,0,nextStage)); replacements.current.clear();
    beginRanking();
    busy.current = false; finished.current = false; presentation.reset();
    const next = freshPopBoard(); boardRef.current = next; setBoard(next);
    const deck=shuffledDeck(6); setWords(deck.slice(0,6)); vocabulary.current=deck.slice(6); runRef.current = fresh(); setRun(fresh()); time.current = 60_000; setRemaining(60_000);
    setStage(nextStage); setPaused(false); select(null); setHint([]); setExchange(null); exchangeRef.current = null;
    setLastRecord(null); setRecords([]); setRecordMessage(""); setFall(false);
    pointer.current = { index: -1, id: -1, x: 0, y: 0, suppress: false };
    setMessage("이웃한 두 카드를 누르거나 밀어 교환하세요. 막히면 힌트를 눌러보세요."); setPhase("play"); setCleared([]);
  }
  function finish(success: boolean, at: number) {
    if (finished.current) return;
    finished.current = true; busy.current = true; setCleared([]); select(null);
    presentation.complete(runRef.current.score, success);
    setPhase(success ? "stage" : "over");
    if (!success) return;
    learning.milestone(stage);
    const record = { stage, difficulty, elapsedMs: Math.max(1, 60_000 - time.current), score: runRef.current.score, at };
    let previous: PopRecord[] = [];
    try { previous = parsePopRecords(localStorage.getItem(POP_RECORD_KEY)); } catch { /* 이번 판은 메모리에서 표시합니다. */ }
    const ranked = rankPopRecords([...previous, record], stage, difficulty);
    setRecords(ranked); setLastRecord(record);
    try {
      localStorage.setItem(POP_RECORD_KEY, JSON.stringify([...previous.filter(r => r.stage !== stage || r.difficulty !== difficulty), ...ranked]));
      setRecordMessage("이 브라우저에 기록을 저장했어요. 다른 사용자와 공유되는 공식 순위는 아닙니다.");
    } catch { setRecordMessage("저장 공간을 사용할 수 없어 이번 화면에서만 기록을 표시해요."); }
  }
  function apply(step: PopStep, chain: number) {
    busy.current = true;
    const before = runRef.current;
    const progress = before.progress + step.counts[before.target]; const done = progress >= goal;
    if(done) { learning.correct(words[before.target].word); replacements.current.add(before.target); missionClock.current=0; setMissionRemaining(missionDuration(difficulty,before.missions+1,stage)); }
    const next = { score: before.score + step.cleared.length * 40 * chain + (done ? 300 : 0), missions: before.missions + (done ? 1 : 0), target: done ? (before.target + 1) % 6 : before.target, progress: done ? 0 : progress, chain };
    runRef.current = next; setRun(next); pending.current = step.board; setCleared(step.cleared); delay.current = 0; setPhase("clear"); select(null);
    setMessage(`${chain > 1 ? `${chain}연쇄! ` : "팡! "}${done ? "한국어 미션 성공 +300 · " : ""}${step.special === "row" ? "줄 폭탄 생성!" : step.special === "star" ? "별 폭탄 생성!" : `${step.cleared.length}개 터졌어요`}`);
    gameCue(done ? "correct" : "pop");
  }
  function swap(a: number, b: number) {
    if (paused || phase !== "play" || busy.current || !adjacent(a, b)) return;
    busy.current = true; select(null); setHint([]); setFall(false);
    const original = boardRef.current; const swapped = original.slice(); [swapped[a], swapped[b]] = [swapped[b], swapped[a]];
    const next = { a, b, original, swapped, step: swapPop(original, a, b) };
    exchangeRef.current = next; setExchange(next); delay.current = 0; setPhase("swap");
  }
  function choose(index: number) {
    if (paused || phase !== "play" || busy.current) return;
    const previous = selection.current;
    setHint([]);
    if (previous === null) select(index);
    else if (previous === index) select(null);
    else if (adjacent(previous, index)) swap(previous, index);
    else { select(index); setMessage("바로 옆이나 위아래의 카드를 골라주세요."); }
  }
  useArcadeTicker(playing, paused, (delta, now) => {
    if (finished.current) return;
    time.current = Math.max(0, time.current - delta); setRemaining(time.current);
    if (!time.current) { finish(runRef.current.score >= targetScore, now); return; }
    if (phase === "play") {
      missionClock.current += delta;
      const limit=missionDuration(difficulty,runRef.current.missions,stage);
      setMissionRemaining(Math.max(0,limit-missionClock.current));
      if(missionClock.current>=limit) { missionClock.current=0; runRef.current={...runRef.current,target:(runRef.current.target+1)%6,progress:0};setRun(runRef.current);setMissionRemaining(limit);setMessage("미션 시간이 끝났어요. 다음 뜻에 도전하세요!");gameCue("miss"); }
      return;
    }
    delay.current += delta;
    if ((phase === "swap" || phase === "return") && delay.current >= popAnimationMs(run.missions,stage,210)) {
      const current = exchangeRef.current;
      if (!current) return;
      if (phase === "swap") {
        if (current.step) { boardRef.current = current.swapped; setBoard(current.swapped); setExchange(null); apply(current.step, 1); }
        else { setPhase("return"); delay.current = 0; setMessage("세 개가 이어지지 않아 돌아왔어요. 힌트로 가능한 교환을 찾아보세요."); gameCue("miss"); }
      } else {
        boardRef.current = current.original; setBoard(current.original); setExchange(null); exchangeRef.current = null; busy.current = false; setPhase("play");
      }
      return;
    }
    if (phase !== "clear" || delay.current < popAnimationMs(run.missions,stage,420)) return;
    boardRef.current = pending.current; setBoard(pending.current); setCleared([]); setFall(true);
    const groups = popMatches(pending.current);
    if (groups.length && runRef.current.chain < 12) apply(clearPop(pending.current, groups), runRef.current.chain + 1);
    else {
      if (runRef.current.score >= targetScore) { finish(true, now); return; }
      if (groups.length || !popLegalMove(pending.current)) { const next = freshPopBoard(); boardRef.current = next; setBoard(next); setMessage("새 조합이 열리도록 보드를 재정렬했어요."); }
      if(replacements.current.size) {
        const changes = new Map<number,VocabItem>();
        for(const kind of replacements.current) { if(!vocabulary.current.length) vocabulary.current=shuffledDeck().filter(item=>!words.some(word=>word.word===item.word)); const item=vocabulary.current.shift();if(item)changes.set(kind,item); }
        replacements.current.clear(); setWords(previous=>previous.map((word,i)=>changes.get(i)??word));
      }
      busy.current = false; setPhase("play");
    }
  }, () => setPaused(true));
  const movement = (index: number): CSSProperties => {
    if (!exchange || phase !== "swap" || (index !== exchange.a && index !== exchange.b)) return {};
    const from = index; const to = index === exchange.a ? exchange.b : exchange.a;
    return { "--pop-x": to % 7 - from % 7, "--pop-y": Math.floor(to / 7) - Math.floor(from / 7) } as CSSProperties;
  };
  const result = phase === "stage" || phase === "over";
  return <section className="word-pop arcade-art-game" aria-label="워드 팝 게임" data-paused={paused} data-phase={phase} data-stage={stage} data-mission-limit={missionDuration(difficulty,run.missions,stage)}>
    <GameHud className="pop-stats" label="워드 팝 상태"><span className="pop-stage-label">STAGE {stage}</span><strong aria-label="워드 팝 점수">{run.score}점</strong><span aria-label="워드 팝 남은 시간">{Math.ceil(remaining / 1000)}초</span></GameHud>
    {phase === "ready" ? <div className="pop-intro"><span aria-hidden="true">🫧</span><h3>단어를 맞추고, 팡!</h3><p>이웃한 두 카드를 클릭하거나 밀어서<br/>같은 영단어 3개를 가로·세로로 이으세요.</p><p>한국어 미션 +300점 · 4개는 줄 폭탄 · 5개는 별 폭탄<br/>미션을 깰수록 제한 시간과 연쇄 속도가 빨라져요<br/>60초 안에 목표 점수 달성! 총 5개 스테이지에 도전해요.<br/>같은 단계·난이도에서 더 빨리 클리어할수록 높은 순위!</p><button className="word-primary" onClick={() => start()}>워드 팝 시작</button></div> : result ? <div className="pop-result">
      <GameOutcome outcome={presentation.outcome}/><h3>{phase === "stage" ? stage === 5 ? "모든 스테이지 클리어!" : `스테이지 ${stage} 클리어!` : "오늘의 팝 타임 끝!"}</h3>
      <p>{run.score}점 / 목표 {targetScore}점 · 한국어 미션 {run.missions}개 성공<br/>{lastRecord ? `클리어 시간 ${formatPopTime(lastRecord.elapsedMs)}` : "다음에는 힌트와 폭탄으로 더 빠르게!"}</p>
      {phase === "stage" ? <section className="pop-records" aria-label="워드 팝 시간 순위"><h4>이 브라우저의 시간 순위</h4><small>스테이지 {stage} · {["초급", "중급", "고급"][difficulty]} · 빠른 시간 순</small><ResultPages label="워드 팝 시간 기록" items={records.map((record, i) => <li key={`${record.at}-${i}`} data-current={record === lastRecord}><b>{i + 1}위 {record === lastRecord ? "이번 기록" : "이전 기록"}</b><span>{formatPopTime(record.elapsedMs)}</span></li>)}/><p>{recordMessage}</p></section> : null}
      <ShareScore game={`워드 팝 스테이지 ${stage}${lastRecord ? ` · ${formatPopTime(lastRecord.elapsedMs)}` : ""}`} score={run.score}/>
      {phase === "stage" && lastRecord ? <RankedRecordSave key={attempt?.runId ?? "guest"} attempt={attempt} game="pop" difficulty={difficulty} stage={stage} score={run.score} elapsedMs={lastRecord.elapsedMs}/> : null}
      <div className="pop-actions">{phase === "stage" && stage < 5 ? <button className="word-primary" onClick={() => start(stage + 1)}>다음 스테이지</button> : null}<button className="word-primary" onClick={() => start()}>다시 팝!</button></div>
    </div> : <div className="pop-play">
      <div className="pop-mission" aria-label="한국어 미션"><div className="pop-mission-copy"><span>이 뜻의 단어를 터뜨려요</span><strong>{words[run.target]?.meaning}</strong><small>{run.progress}/{goal}개 · 미션 {run.missions}개 성공 · {Math.ceil(missionRemaining/1000)}초</small></div></div>
      <div className="pop-score-goal"><div><b>STAGE {stage}</b><span>{run.score} / {targetScore}점</span><button disabled={paused || phase !== "play"} onClick={() => { const move = popLegalMove(boardRef.current); setHint(move ?? []); setMessage("반짝이는 두 카드를 바꿔보세요!"); }}>힌트</button></div><progress aria-label="스테이지 목표 점수" max={targetScore} value={Math.min(targetScore, run.score)}/></div>
      <div className="pop-board-wrap"><div className={`pop-board ${fall ? "board-falling" : ""}`} aria-label="단어 퍼즐 보드">
        {board.map((tile, index) => <button key={index} style={{ ...movement(index), "--pop-len": Math.max(4, (words[tile.kind]?.word.length ?? 8)), "--pop-i": index % 7 + Math.floor(index / 7) } as CSSProperties} data-kind={tile.kind} className={`pop-tile tile-${tile.kind} ${selected === index ? "tile-selected" : ""} ${cleared.includes(index) ? "tile-burst" : ""} ${hint.includes(index) ? "tile-hint" : ""} ${exchange && [exchange.a, exchange.b].includes(index) ? "tile-exchanging" : ""}`} disabled={paused || phase !== "play"} aria-label={`${Math.floor(index / 7) + 1}행 ${index % 7 + 1}열 ${words[tile.kind]?.word}${tile.special ? tile.special === "row" ? " 줄 폭탄" : " 별 폭탄" : ""}`} aria-pressed={selected === index}
          onClick={() => { if (pointer.current.suppress) { pointer.current.suppress = false; return; } choose(index); }}
          onPointerDown={e => { pointer.current = { index, id: e.pointerId, x: e.clientX, y: e.clientY, suppress: false }; e.currentTarget.setPointerCapture(e.pointerId); }}
          onPointerCancel={() => { pointer.current.index = -1; }}
          onPointerUp={e => {
            const from = pointer.current; const dx = e.clientX - from.x; const dy = e.clientY - from.y;
            if (from.index !== index || from.id !== e.pointerId || Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
            const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? 1 : -1 : dy > 0 ? 7 : -7;
            pointer.current.suppress = true; swap(index, index + direction);
          }}><em className="pop-gloss" aria-hidden="true"/><em className="pop-twinkle" aria-hidden="true"/><span>{["✦", "●", "◆", "♥", "✿", "⬟"][tile.kind]}</span><strong>{words[tile.kind]?.word}</strong>{tile.special ? <i>{tile.special === "row" ? "↔" : "★"}</i> : null}{cleared.includes(index) ? <span className="pop-sparks" aria-hidden="true">{Array.from({ length: 10 }, (_, i) => <em key={i} style={{ "--spark-angle": `${i * 36}deg`, "--spark-delay": `${i % 3 * 40}ms` } as CSSProperties}>{i % 2 ? "✦" : "●"}</em>)}</span> : null}</button>)}
      </div>{paused ? <div className="word-pause">잠깐 쉬는 중 · 우측 상단 재생 버튼을 눌러주세요</div> : null}</div>
      <div className="pop-footer"><p className="pop-message" role="status">{message}</p><details className="pop-glossary"><summary>단어 뜻 보기</summary><div className="pop-word-key">{words.map((word, i) => <span key={word.word} className={`key-${i}`}><b>{word.word}</b> {word.meaning}</span>)}</div></details></div>
    </div>}
    <p className="word-note">브라우저별 연습 기록 · 코인과 원격 DB에는 자동 저장하지 않습니다.</p>
  </section>;
}
