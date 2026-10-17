"use client";

import { unlockedDifficulty, useLearningProgress, type LearningGame } from "@/lib/learning-progress";

const names = { cab: "옐로캡 러시", fork: "갈림길", pop: "워드 팝", boss: "메모리 카드" };
export function GameDifficultySelect({ game, onSelect }: { game: LearningGame; onSelect: (difficulty: number) => void }) {
  const { record, loading, volatile } = useLearningProgress();
  const level = unlockedDifficulty(record, game);
  return <section className="game-difficulty-screen" aria-label="게임 난이도 선택"><div>
    <small>나의 다음 도전</small><h2>{names[game]}</h2><p>처음에는 초급부터. 이 게임의 스테이지를 깨면 다음 맵이 열려요.</p>
    <div className="game-difficulty-options">{["초급", "중급", "고급"].map((name, i) => <button key={name} disabled={loading || i > level} onClick={() => onSelect(i)} aria-label={`${name} 시작`}>
      <span>{i > level ? "🔒" : "✦"}</span><b>{name}</b><small>{i === 0 ? "처음부터 천천히 · 점점 빨라져요" : i === 1 ? "초급 STAGE 1 클리어 시 열림" : "중급 STAGE 2 클리어 시 열림"}</small><em>{record.stages[game]?.[i] ? `최고 STAGE ${record.stages[game]![i]}` : i > level ? "아직 잠겨 있어요" : "시작하기 →"}</em>
    </button>)}</div>
    <p className="difficulty-rule">{game === "cab" || game === "fork" ? "정답 10개마다 한 스테이지를 통과합니다." : game === "pop" ? "목표 점수를 채우면 스테이지를 통과합니다." : "카드의 70% 이상을 시간 안에 기억하면 스테이지를 통과합니다."}<br/>{volatile ? "저장이 불가능해 현재 페이지에서만 해제 상태를 유지합니다." : "해제 기록은 계정별로 이 브라우저에 저장됩니다."}</p>
  </div></section>;
}
