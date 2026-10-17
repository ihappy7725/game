"use client";

import { useState } from "react";
import { VOCAB } from "@/lib/vocab";
import { VOCAB_GOAL, useLearningProgress } from "@/lib/learning-progress";
import { gameCue } from "@/lib/game-feedback";

export function VocabularyProgressButton({ onClick }: { onClick: () => void }) {
  const { record, loading } = useLearningProgress();
  return <button className="vocab-home-progress" aria-label="학습한 단어량 열기" onClick={onClick}>
    <span><b>학습한 단어량</b><strong>{loading ? "확인 중" : `${record.learned.length.toLocaleString()}/4,000`}</strong></span>
    <progress aria-label="전체 단어 학습량" max={VOCAB_GOAL} value={record.learned.length}/>
    <small>현재 등록 {VOCAB.length}개 · 단어장 열기 ↗</small>
  </button>;
}

export function VocabularyLibrary() {
  const progress = useLearningProgress();
  const [block, setBlock] = useState<number | null>(null);
  const [card, setCard] = useState<number | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [search, setSearch] = useState("");
  const learned = new Set(progress.record.learned);
  const words = block === null ? [] : VOCAB.slice(block * 100, (block + 1) * 100);
  const current = card === null ? null : words[card];
  function advance(remembered: boolean) {
    if (!current || card === null) return;
    if (remembered) { progress.learn([current.word]); gameCue("correct"); }
    setFlipped(false); setCard(card + 1 < words.length ? card + 1 : null);
  }
  return <section className="vocab-library" aria-label="단어 학습실">
    <header><small>한 단어씩 쌓이는 나의 영어</small><h2>학습한 단어량</h2><p>{progress.record.learned.length} / 목표 {VOCAB_GOAL.toLocaleString()}단어 · 현재 등록 {VOCAB.length}단어</p><progress aria-label="단어장 전체 학습량" max={VOCAB_GOAL} value={progress.record.learned.length}/></header>
    <p className="vocab-storage-note" role="status">{progress.volatile ? "저장 공간을 사용할 수 없어 현재 페이지에서만 기록됩니다." : progress.loading ? "로그인 상태 확인 중입니다." : "계정별로 이 브라우저에 저장됩니다. 재접속해도 유지되며, 기기 간 동기화는 아직 지원하지 않습니다."}</p>
    {block === null ? <>
      <p className="vocab-storage-note">게임의 정답·한국어 미션 성공·카드 기억 확인도 같은 그래프에 반영됩니다. 같은 단어는 한 번만 집계합니다.</p>
      <div className="vocab-blocks">{Array.from({ length: Math.ceil(VOCAB_GOAL / 100) }, (_, i) => {
        const entries = VOCAB.slice(i * 100, (i + 1) * 100), count = entries.filter(word => learned.has(word.word)).length;
        return <button key={i} disabled={!entries.length} onClick={() => { setBlock(i); setSearch(""); }} aria-label={`단어 블록 ${i + 1}`}>
          <span>BLOCK {String(i + 1).padStart(2, "0")}</span><b>{i * 100 + 1}–{(i + 1) * 100}</b>
          <div><progress aria-label={`${i + 1}블록 학습량`} max={100} value={count}/><strong>{count}/100</strong></div>
          <small>{entries.length === 100 ? "단어 목록과 플래시카드" : entries.length ? `${entries.length}개 등록 · 나머지 준비 중` : "어휘 자료 준비 중"}</small>
        </button>;
      })}</div>
    </> : <>
      <div className="vocab-toolbar"><button onClick={() => { setBlock(null); setCard(null); }}>← 전체 블록</button><h3>블록 {block + 1} · {words.filter(w => learned.has(w.word)).length}/100</h3><button onClick={() => { setCard(0); setFlipped(false); }}>플래시카드 시작</button></div>
      {current ? <section className="vocab-card-session" aria-label="단어장 플래시카드">
        <small>{card! + 1}/{words.length} · 제한 시간 없는 학습</small>
        <button className="vocab-flashcard" aria-label={flipped ? "단어 앞면 보기" : "단어 정답 뒤집기"} onClick={() => setFlipped(!flipped)}><small>{flipped ? current.word : "뜻을 떠올려 보세요"}</small><strong>{flipped ? current.meaning : current.word}</strong>{flipped ? <><span>{current.synonym}</span><p>{current.example}</p></> : <span>클릭 또는 스페이스로 뒤집기</span>}</button>
        {flipped ? <div className="vocab-card-actions"><button onClick={() => advance(false)}>다시 볼게요</button><button disabled={progress.loading} onClick={() => advance(true)}>기억했어요</button></div> : null}
        <button onClick={() => setCard(null)}>단어 목록으로</button>
      </section> : <>
        <label className="vocab-search">단어 검색<input value={search} onChange={e => setSearch(e.target.value)} placeholder="영단어 또는 한국어 뜻"/></label>
        <ul className="vocab-word-list">{words.map((word, index) => ({ word, index })).filter(({ word }) => `${word.word} ${word.meaning}`.toLowerCase().includes(search.toLowerCase())).map(({ word, index }) => <li key={word.word}><div><b>{word.word}</b><span>{word.meaning}</span><small>{word.example}</small></div><button onClick={() => { setCard(index); setFlipped(false); }}>{learned.has(word.word) ? "✓ 복습" : "학습하기"}</button></li>)}</ul>
      </>}
    </>}
  </section>;
}
