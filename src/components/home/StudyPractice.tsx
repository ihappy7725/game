"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AGENT_MISSIONS } from "@/lib/agent-missions";
import { useProgression } from "@/lib/progression";

const READING = [
  { passage:"In several American cities, small urban gardens occupy land that once stood vacant. Volunteers grow vegetables, but food production is only one benefit. Neighbors who rarely met before now exchange advice and organize weekend activities. These social ties can make a neighborhood more resilient during difficult times.", questions:[
    { question:"What previously occupied the garden sites?", options:["Unused land","Busy markets","Large farms"], correct:0, explanation:"once stood vacant가 이전에 비어 있던 땅임을 알려 줍니다." },
    { question:"Why does the author mention weekend activities?", options:["To describe paid employment","To illustrate stronger social connections","To criticize food production"], correct:1, explanation:"활동 사례는 이웃 사이의 사회적 연결이라는 부가 효과를 뒷받침합니다." },
    { question:"Which conclusion is best supported?", options:["Gardens eliminate economic hardship","Vegetables are the primary source of city income","Shared spaces may strengthen community resilience"], correct:2, explanation:"can make와 may는 가능성을 나타냅니다. 모든 어려움을 해결한다는 주장은 과도합니다." },
  ] },
  { passage:"Researchers studying migratory birds once relied mainly on brief observations at a few locations. Lightweight tracking devices now reveal entire journeys. Yet the new data are not automatically representative: devices may be attached only to birds large enough to carry them. Conclusions about migration must therefore account for which species were actually measured.", questions:[
    { question:"What do tracking devices reveal?", options:["Complete migration routes","Only nesting temperatures","The age of every bird"], correct:0, explanation:"reveal entire journeys는 전체 이동 경로를 파악한다는 뜻입니다." },
    { question:"What limitation does the author identify?", options:["Birds no longer migrate","Larger species may be overrepresented","Observations have become impossible"], correct:1, explanation:"장치를 운반할 수 있는 큰 새들만 측정하면 표본이 편향될 수 있습니다." },
    { question:"Which finding would most strengthen the author's concern?", options:["Smaller untracked species take very different routes","All species follow identical routes","Devices become less expensive"], correct:0, explanation:"미측정 종의 경로가 다르면 일부 종의 결과를 전체로 일반화하기 어렵습니다." },
  ] },
  { passage:"A university replaced some lecture sessions with workshops in which students explained concepts to peers. Exam scores rose, but the instructors cautioned against attributing the improvement solely to peer instruction. The revised course also offered more practice questions and attracted students who had chosen its new format. A controlled comparison would be needed to distinguish these influences.", questions:[
    { question:"What changed in the course?", options:["All exams were removed","Students explained ideas to classmates","Lectures became longer"], correct:1, explanation:"explained concepts to peers가 동료 학생에게 개념을 설명하는 활동입니다." },
    { question:"Why are practice questions mentioned?", options:["As an alternative explanation for higher scores","As proof that workshops failed","To explain declining attendance"], correct:0, explanation:"연습 문제 증가도 성적 향상에 영향을 주었을 수 있어 인과 추론을 제한합니다." },
    { question:"What study would best isolate the effect of peer instruction?", options:["Survey only students who liked workshops","Compare unrelated courses at different schools","Randomly assign similar students while holding practice materials constant"], correct:2, explanation:"다른 조건을 통제하고 무작위로 배정하면 동료 학습의 독립적인 효과를 더 잘 비교할 수 있습니다." },
  ] },
];
export function StudyPractice({ section, active = true }: { section: "reading" | "listening"; active?: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { level } = useProgression();
  const [requestedIndex,setIndex]=useState(0); const [answers,setAnswers]=useState<Record<number,number>>({});
  const [reveal,setReveal]=useState(false); const id=useId();
  const count=(level+1)*3; const index=Math.min(requestedIndex,count-1); const group=index%3; const depth=Math.floor(index/3);
  const passage=READING[group]; const mission=AGENT_MISSIONS[group];
  const correctChoice=section==="reading" ? passage.questions[depth].correct : mission.choices.findIndex(c=>c.id===mission.order[depth]);
  const options=section==="reading" ? passage.questions[depth].options : mission.choices.map(c=>c.label);
  const question=section==="reading" ? passage.questions[depth].question : ["Which stop or step comes first?","Which stop or step comes second?","Which stop or step comes last?"][depth];
  const explanation=section==="reading" ? passage.questions[depth].explanation : mission.explanation;
  useEffect(() => {
    const audio=audioRef.current;
    if(!active) audio?.pause();
    return () => audio?.pause();
  },[active,group]);
  return <section aria-label={`${section==="reading" ? "리딩" : "리스닝"} 연습`} className="study-practice">
    <p className="hub-eyebrow">오늘 한 문제, 더 멀리</p><h2 className="mt-2 text-3xl font-bold">{section==="reading" ? "Reading" : "Listening"} 연습실</h2><p className="mt-3 text-sm text-slate-500">창작 TOEFL 유형 연습 · 공식 ETS 문항이 아닙니다. 현재 {count}/9문제 해제 · 풀이 결과는 이 화면에서 유지됩니다.</p>
    <nav aria-label="연습 문제 선택" className="my-6 flex flex-wrap gap-2">{Array.from({length:9},(_,i)=><button key={i} disabled={i>=count} aria-pressed={i===index} onClick={()=>{setIndex(i);setReveal(false);}} className={`hub-small-button ${i===index ? "selected" : ""}`}>{i>=count ? "🔒 " : ""}{i+1}</button>)}</nav>
    <p className="mb-3 text-xs font-semibold text-teal-700">{["핵심 정보","의도와 관계","추론과 종합"][depth]}</p>
    {section==="reading" ? <p className="study-passage">{passage.passage}</p> : <div className="space-y-4 rounded-2xl bg-teal-50 p-5"><h3 className="font-bold">{mission.title}</h3><audio ref={audioRef} key={mission.id} controls preload="metadata" src={`/audio/agent/${mission.id}.wav`} className="w-full" aria-label="리스닝 연습 음원" /><details><summary className="cursor-pointer text-sm">대본 읽기</summary><p className="mt-3 leading-relaxed">{mission.transcript}</p></details></div>}
    <fieldset className="mt-6 space-y-3"><legend className="mb-4 text-lg font-semibold">{question}</legend>{options.map((option,i)=><label key={option} className={`study-option ${answers[index]===i ? "selected" : ""}`}><input type="radio" name={id} checked={answers[index]===i} onChange={()=>{setAnswers({...answers,[index]:i});setReveal(false);}} />{option}</label>)}</fieldset>
    <button disabled={answers[index]===undefined} onClick={()=>setReveal(true)} className="hub-primary mt-6">정답과 해설</button>
    {reveal ? <div role="status" className="mt-5 rounded-2xl bg-amber-50 p-5"><p className="font-bold">{answers[index]===correctChoice ? "정답이에요!" : "단서를 다시 찾아볼까요?"} 정답: {options[correctChoice]}</p><p className="mt-2 text-sm leading-relaxed">{explanation}</p></div> : null}
  </section>;
}
