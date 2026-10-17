"use client";

import { ArcadeEffects } from "./ArcadeEffects";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { GameOutcome } from "./GameOutcome";
import { ShareScore } from "./ShareScore";

import { useEffect, useRef, useState } from "react";
import { fetchReviewMistakes, recordReviewAnswer, type MistakeSource, type VocabAnswer } from "@/lib/api";
import { gameError, tokenForGameUser, useGameState } from "@/lib/game-state";
import { useGameResource } from "@/components/dorm/useGameResource";
import { GameHud } from "./GameHud";
import { useGamePause } from "./GamePause";
import { useGameLearning } from "@/lib/learning-progress";
import { memoryDuration } from "@/lib/game-tempo";
import { useArcadeTicker } from "./useArcadeTicker";
import { shuffled, shuffledDeck, VOCAB } from "@/lib/vocab";

type Question = { prompt: string; correct_answer: string; source?: string };
const buttonClass = "rounded-xl border border-violet-200/25 px-4 py-3 hover:bg-white/10 disabled:opacity-40";
export function MemoryBossRaid({difficulty=0}:{difficulty?:number}) {
  const { auth } = useGameState();
  if(auth.status === "loading") return <MemoryLobby loading message="로그인 상태 확인 중…"/>;
  return auth.status === "signed-in" ? <AccountBoss key={auth.userId} userId={auth.userId} difficulty={difficulty}/> : <BossGame questions={VOCAB.map(q => ({ prompt:q.word, correct_answer:q.synonym }))} difficulty={difficulty}/>;
}
function AccountBoss({ userId,difficulty }: { userId: string; difficulty:number }) {
  const resource = useGameResource(userId, fetchReviewMistakes);
  const [practice, setPractice] = useState(false);
  if (practice) return <BossGame questions={VOCAB.map(q => ({ prompt:q.word, correct_answer:q.synonym }))} difficulty={difficulty}/>;
  if (resource.loading) return <MemoryLobby loading message="나의 오답을 불러오는 중…"/>;
  const items = Array.isArray(resource.data?.items) ? resource.data.items : null;
  const error = resource.error ?? (!items ? "복습 기록 응답을 확인하지 못했어요. 잠시 후 새로고침하거나 예제 카드로 연습해 주세요." : null);
  if (error || !items?.length) return <MemoryLobby error={Boolean(error)} message={error ?? "아직 복습할 오답이 없어요. 새로운 문제에 도전하거나 예제 카드로 가볍게 시작해 보세요."} onReload={resource.reload} onPractice={() => setPractice(true)}/>;
  return <BossGame questions={items} userId={userId} difficulty={difficulty}/>;
}
function MemoryLobby({ loading = false, error = false, message, onReload, onPractice }: {
  loading?: boolean; error?: boolean; message: string; onReload?: () => void; onPractice?: () => void;
}) {
  return <section className="memory-lobby arcade-art-game" aria-label="메모리 카드 대기실">
    <div className="memory-lobby-panel"><span className="memory-lobby-emblem" aria-hidden="true">✦</span><p className="memory-eyebrow">한 장씩, 더 오래 기억하도록</p><h2>메모리 카드</h2>
      <p className="memory-lobby-message" role={error ? "alert" : "status"}>{message}</p>
      {!loading ? <div className="memory-lobby-actions"><button className="word-primary" onClick={onPractice}>예제 카드 연습</button><button className="memory-refresh" onClick={onReload}>오답 새로고침</button></div> : <span className="memory-loading" aria-hidden="true">● ● ●</span>}
      <small>{loading ? "잠시만 기다려 주세요" : "예제 연습은 개인 오답과 코인에 영향을 주지 않아요."}</small>
    </div>
  </section>;
}
function BossGame({ questions:sourceQuestions, userId,difficulty }: { questions: Question[]; userId?: string; difficulty:number }) {
  const learning=useGameLearning("boss",difficulty);
  const [questions,setQuestions]=useState(sourceQuestions.slice(0,[6,12,18][difficulty]));
  const [remaining,setRemaining]=useState(memoryDuration(difficulty,0));
  const [timedOut,setTimedOut]=useState(false); const { paused,setPaused }=useGamePause();
  const clock=useRef(0);
  function start() {
    learning.begin();clock.current=0;setTimedOut(false);setPaused(false);setRemaining(memoryDuration(difficulty,0));
    const pool=userId ? shuffled(sourceQuestions) : shuffledDeck([6,12,18][difficulty]).map(q=>({prompt:q.word,correct_answer:q.synonym}));
    setQuestions(pool.slice(0,[6,12,18][difficulty]));judged.current=false;setPhase("front");
  }
  const [phase,setPhase] = useState<"ready"|"front"|"back"|"over">("ready");
  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<(VocabAnswer & {source: MistakeSource})[]>([]);
  const [saving,setSaving] = useState(false); const [message,setMessage] = useState("");
  const locked=useRef(false); const judged=useRef(false); const mounted=useRef(false);
  const presentation = useGameOutcome("cards",difficulty);
  useGameLoop("cards", phase === "over" ? "ended" : phase === "ready" ? "idle" : paused ? "paused" : "running");
  const question=questions[index]; const correct=answers.filter(q=>q.was_correct).length;
  useArcadeTicker(phase==="front",paused,delta=>{clock.current+=delta;const limit=memoryDuration(difficulty,index);setRemaining(Math.max(0,limit-clock.current));if(clock.current>=limit){setTimedOut(true);setPhase("back");gameCue("miss");}},()=>setPaused(true));
  useEffect(()=>{ mounted.current=true; return ()=>{ mounted.current=false; }; },[]);
  function remember(wasCorrect:boolean) {
    if(phase!=="back" || paused || judged.current || (wasCorrect && timedOut)) return;
    judged.current=true;
    if(wasCorrect) { gameCue("correct"); learning.correct(question.prompt); }
    setAnswers([...answers,{source: (question.source ?? "vocab") as MistakeSource, prompt:question.prompt,correct_answer:question.correct_answer,chosen:wasCorrect ? "자가 확인: 기억했어요" : "자가 확인: 다시 볼게요",was_correct:wasCorrect}]);
    if(index===questions.length-1){ if((correct+(wasCorrect?1:0))/questions.length>=.7)learning.milestone(difficulty+1); presentation.complete((correct+(wasCorrect?1:0))*100,(correct+(wasCorrect?1:0))/questions.length>=.7); setPhase("over"); }
    else { clock.current=0;setRemaining(memoryDuration(difficulty,index+1));setTimedOut(false);setIndex(index+1);judged.current=false;setPhase("front"); }
  }
  async function save() {
    if(!userId || locked.current) return;locked.current=true;setSaving(true);
    try { for(const item of answers) { if(!mounted.current) break; const token=await tokenForGameUser(userId); if(!mounted.current) break; await recordReviewAnswer(token,item.source,{prompt:item.prompt,correct_answer:item.correct_answer,chosen:item.chosen,was_correct:item.was_correct}); }if(mounted.current)setMessage("자가 복습 결과를 저장했습니다. 같은 어휘를 2회 연속 기억했다고 표시하면 서버 오답 목록에서 졸업합니다."); }
    catch(error) { if(mounted.current)setMessage(`${gameError(error)} 일부 결과가 저장됐을 수 있어 재전송하지 않습니다. 다음 입장 때 오답을 확인하세요.`); }
    finally { if(mounted.current)setSaving(false); }
  }
  function restart() { presentation.reset(); setIndex(0);setAnswers([]);judged.current=false;locked.current=false;setMessage("");setPhase("ready"); }
  return <section aria-label="오답 보스전" data-paused={paused} className="boss-game flashcard-game arcade-art-game space-y-6 rounded-3xl p-6 sm:p-10">
    <GameHud className="memory-stats" label="메모리 상태"><span>STAGE {difficulty+1}</span><span>카드 {phase==="ready" ? 0 : index+1}/{questions.length}</span><span>기억 <strong>{correct}</strong></span><span className="memory-tempo">떠올리기 {Math.ceil(remaining/1000)}초</span></GameHud>
    <div className="memory-library art-landscape" aria-hidden="true"/><div className="memory-glow" aria-hidden="true"/><ArcadeEffects kind="ambient"/>{phase==="ready" ? <header><p className="text-sm text-violet-200">기억을 되찾는 한 장의 카드</p><h2 className="mt-2 text-3xl font-bold">메모리 카드</h2><p className="mt-3 text-sm text-violet-100/70">{userId ? "내 오답 복습" : "예제 연습 · 개인 오답이나 코인에 반영되지 않습니다."}</p></header> : null}
    {phase==="ready" ? <div className="space-y-5"><div className="flashcard-preview" aria-hidden="true"><i/><i/><i/><span>✦</span></div><p className="text-sm leading-relaxed">앞면을 보고 동의어를 떠올린 다음 카드를 뒤집으세요. 기억한 카드와 다시 볼 카드를 나눕니다. 카드가 진행될수록 생각할 시간이 짧아집니다. 시간 초과 카드는 다시 복습하세요.</p><p className="text-xs text-white/60">자동 채점이 아닌 자가 복습입니다. 결과를 저장하기 전까지 서버 오답은 바뀌지 않습니다.</p><button className={buttonClass} onClick={start}>플래시카드 시작</button></div> : phase==="over" ? <div className="space-y-5">
      <GameOutcome outcome={presentation.outcome}/><h3 className="text-2xl font-bold">오늘의 복습 완료</h3><p>기억했어요 {correct}장 · 다시 볼 카드 {questions.length-correct}장</p>
      <ol className="space-y-3">{answers.map((answer,i)=><li key={i} className="rounded-xl bg-white/5 p-3"><span className="mr-3">{answer.was_correct ? "✓" : "↻"}</span>{answer.prompt} → {answer.correct_answer}</li>)}</ol>
      {userId ? <button className={buttonClass} disabled={saving || Boolean(message)} onClick={save}>{saving ? "저장 중…" : "오답 복습 저장"}</button> : null}
      <button className={buttonClass} disabled={saving} onClick={restart}>다시 복습</button>
      <ShareScore game="메모리 카드 자가 복습" score={correct*100}/>
      {message ? <p role="status">{message}</p> : null}
    </div> : <div className="space-y-5">
      {paused ? <p role="status">잠깐 쉬는 중 · 우측 상단 재생 버튼을 눌러주세요</p> : null}
      {timedOut ? <p role="status">시간이 끝났어요. 정답을 확인하고 다시 복습하세요.</p> : null}
      <button type="button" className={`memory-flashcard ${phase==="back" ? "card-back" : ""}`} disabled={paused || timedOut} aria-label={phase==="front" ? "정답 뒤집기" : "카드 앞면 보기"} onClick={()=>setPhase(phase==="front" ? "back" : "front")}>
        <small>{phase==="front" ? "이 단어의 동의어는?" : question.prompt}</small><strong>{phase==="front" ? question.prompt : question.correct_answer}</strong><span>{phase==="front" ? "클릭하거나 스페이스로 뒤집기" : "기억했는지 솔직하게 표시해 주세요"}</span>
      </button>
      {phase==="back" ? <div className="flex flex-wrap justify-center gap-3"><button disabled={paused} className={buttonClass} onClick={()=>remember(false)}>다시 볼게요</button><button disabled={paused || timedOut} className={`${buttonClass} bg-emerald-300/15`} onClick={()=>remember(true)}>기억했어요</button></div> : <p className="text-center text-xs text-white/50">천천히 떠올려도 괜찮아요.</p>}
    </div>}
  </section>;
}
