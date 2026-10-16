import type { GameOutcome as Outcome } from "@/lib/game-feedback";

export function GameOutcome({ outcome }: { outcome: Outcome | null }) {
  if (!outcome) return null;
  return <aside className={`game-outcome outcome-${outcome.celebration ? "good" : "sad"}`} aria-label="게임 결과 연출">
    <p className="outcome-summary">{outcome.record ? "이 브라우저의 개인 신기록!" : outcome.celebration ? "멋지게 해냈어요!" : "ㅠㅠ 아쉬워도 다음 판이 있어요"}<small>이 브라우저 최고 기록 {outcome.best}점</small></p>
    <div aria-hidden="true" className="outcome-burst">{outcome.celebration ? Array.from({ length: 18 }, (_, i) => <span key={i} style={{ left: `${4 + i * 5.3}%`, animationDelay: `${i % 5 * .09}s` }}>{["🎉", "👏", "✨", "🎊"][i % 4]}</span>) : <><i className="outcome-dim"/><span className="outcome-tears">ㅠㅠ</span></>}</div>
  </aside>;
}
