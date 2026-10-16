"use client";

import { ArcadeEffects } from "./ArcadeEffects";
import { gameCue, useGameLoop, useGameOutcome } from "@/lib/game-feedback";
import { GameOutcome } from "./GameOutcome";
import { ShareScore } from "./ShareScore";

import { useEffect, useRef, useState } from "react";
import { fetchReviewMistakes, recordReviewAnswer, type MistakeSource, type VocabAnswer } from "@/lib/api";
import { gameError, tokenForGameUser, useGameState } from "@/lib/game-state";
import { useGameResource } from "@/components/dorm/useGameResource";
import { VOCAB } from "@/lib/vocab";

type Question = { prompt: string; correct_answer: string; source?: string };
const buttonClass = "rounded-xl border border-violet-200/25 px-4 py-3 hover:bg-white/10 disabled:opacity-40";
export function MemoryBossRaid() {
  const { auth } = useGameState();
  if(auth.status === "loading") return <MemoryLobby loading message="로그인 상태 확인 중…"/>;
  return auth.status === "signed-in" ? <AccountBoss key={auth.userId} userId={auth.userId} /> : <BossGame questions={VOCAB.slice(0,6).map(q => ({ prompt:q.word, correct_answer:q.synonym }))} />;
}
function AccountBoss({ userId }: { userId: string }) {
  const resource = useGameResource(userId, fetchReviewMistakes);
  const [practice, setPractice] = useState(false);
  if (practice) return <BossGame questions={VOCAB.slice(0,6).map(q => ({ prompt:q.word, correct_answer:q.synonym }))} />;
  if (resource.loading) return <MemoryLobby loading message="나의 오답을 불러오는 중…"/>;
  if (resource.error || !resource.data?.items.length) return <MemoryLobby error={Boolean(resource.error)} message={resource.error ?? "아직 복습할 오답이 없어요. 새로운 문제에 도전하거나 예제 카드로 가볍게 시작해 보세요."} onReload={resource.reload} onPractice={() => setPractice(true)}/>;
  return <BossGame questions={resource.data.items} userId={userId} />;
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
function BossGame({ questions, userId }: { questions: Question[]; userId?: string }) {
  const [phase,setPhase] = useState<"ready"|"front"|"back"|"over">("ready");
  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<(VocabAnswer & {source: MistakeSource})[]>([]);
  const [saving,setSaving] = useState(false); const [message,setMessage] = useState("");
  const locked=useRef(false); const judged=useRef(false); const mounted=useRef(false);
  const presentation = useGameOutcome("cards");
  useGameLoop("cards", phase === "over" ? "ended" : phase === "ready" ? "idle" : "running");
  const question=questions[index]; const correct=answers.filter(q=>q.was_correct).length;
  useEffect(()=>{ mounted.current=true; return ()=>{ mounted.current=false; }; },[]);
  function remember(wasCorrect:boolean) {
    if(phase!=="back" || judged.current) return;
    judged.current=true;
    if(wasCorrect) gameCue("correct");
    setAnswers([...answers,{source: (question.source ?? "vocab") as MistakeSource, prompt:question.prompt,correct_answer:question.correct_answer,chosen:wasCorrect ? "자가 확인: 기억했어요" : "자가 확인: 다시 볼게요",was_correct:wasCorrect}]);
    if(index===questions.length-1){ presentation.complete((correct+(wasCorrect?1:0))*100,(correct+(wasCorrect?1:0))/questions.length>=.7); setPhase("over"); }
    else { setIndex(index+1);judged.current=false;setPhase("front"); }
  }
  async function save() {
    if(!userId || locked.current) return;locked.current=true;setSaving(true);
    try { for(const item of answers) { if(!mounted.current) break; const token=await tokenForGameUser(userId); if(!mounted.current) break; await recordReviewAnswer(token,item.source,{prompt:item.prompt,correct_answer:item.correct_answer,chosen:item.chosen,was_correct:item.was_correct}); }if(mounted.current)setMessage("자가 복습 결과를 저장했습니다. 같은 어휘를 2회 연속 기억했다고 표시하면 서버 오답 목록에서 졸업합니다."); }
    catch(error) { if(mounted.current)setMessage(`${gameError(error)} 일부 결과가 저장됐을 수 있어 재전송하지 않습니다. 다음 입장 때 오답을 확인하세요.`); }
    finally { if(mounted.current)setSaving(false); }
  }
  function restart() { presentation.reset(); setIndex(0);setAnswers([]);judged.current=false;locked.current=false;setMessage("");setPhase("ready"); }
  return <section aria-label="오답 보스전" className="boss-game flashcard-game arcade-art-game space-y-6 rounded-3xl p-6 sm:p-10">
    <div className="memory-library art-landscape" aria-hidden="true"/><div className="memory-glow" aria-hidden="true"/><ArcadeEffects kind="ambient"/><header><p className="text-sm text-violet-200">기억을 되찾는 한 장의 카드</p><h2 className="mt-2 text-3xl font-bold">메모리 카드</h2><p className="mt-3 text-sm text-violet-100/70">{userId ? "내 오답 복습" : "예제 연습 · 개인 오답이나 코인에 반영되지 않습니다."}</p></header>
    {phase==="ready" ? <div className="space-y-5"><div className="flashcard-preview" aria-hidden="true"><i/><i/><i/><span>✦</span></div><p className="text-sm leading-relaxed">앞면을 보고 동의어를 떠올린 다음 카드를 뒤집으세요. 기억한 카드와 다시 볼 카드를 나눕니다. 제한 시간은 없습니다.</p><p className="text-xs text-white/60">자동 채점이 아닌 자가 복습입니다. 결과를 저장하기 전까지 서버 오답은 바뀌지 않습니다.</p><button className={buttonClass} onClick={()=>{judged.current=false;setPhase("front");}}>플래시카드 시작</button></div> : phase==="over" ? <div className="space-y-5">
      <GameOutcome outcome={presentation.outcome}/><h3 className="text-2xl font-bold">오늘의 복습 완료</h3><p>기억했어요 {correct}장 · 다시 볼 카드 {questions.length-correct}장</p>
      <ol className="space-y-3">{answers.map((answer,i)=><li key={i} className="rounded-xl bg-white/5 p-3"><span className="mr-3">{answer.was_correct ? "✓" : "↻"}</span>{answer.prompt} → {answer.correct_answer}</li>)}</ol>
      {userId ? <button className={buttonClass} disabled={saving || Boolean(message)} onClick={save}>{saving ? "저장 중…" : "오답 복습 저장"}</button> : null}
      <button className={buttonClass} disabled={saving} onClick={restart}>다시 복습</button>
      <ShareScore game="메모리 카드 자가 복습" score={correct*100}/>
      {message ? <p role="status">{message}</p> : null}
    </div> : <div className="space-y-5">
      <p className="text-sm text-white/70">카드 {index+1}/{questions.length} · 기억한 카드 {correct}장</p>
      <button type="button" className={`memory-flashcard ${phase==="back" ? "card-back" : ""}`} aria-label={phase==="front" ? "정답 뒤집기" : "카드 앞면 보기"} onClick={()=>setPhase(phase==="front" ? "back" : "front")}>
        <small>{phase==="front" ? "이 단어의 동의어는?" : question.prompt}</small><strong>{phase==="front" ? question.prompt : question.correct_answer}</strong><span>{phase==="front" ? "클릭하거나 스페이스로 뒤집기" : "기억했는지 솔직하게 표시해 주세요"}</span>
      </button>
      {phase==="back" ? <div className="flex flex-wrap justify-center gap-3"><button className={buttonClass} onClick={()=>remember(false)}>다시 볼게요</button><button className={`${buttonClass} bg-emerald-300/15`} onClick={()=>remember(true)}>기억했어요</button></div> : <p className="text-center text-xs text-white/50">천천히 떠올려도 괜찮아요.</p>}
    </div>}
  </section>;
}
