/** 고정된 배치의 장식만 사용하므로 재렌더마다 파티클 위치가 바뀌지 않습니다. */
export function ArcadeEffects({ kind = "success", eventKey = 0 }: { kind?: "success" | "miss" | "ambient"; eventKey?: string | number }) {
  return <span key={eventKey} className={`arcade-particles particles-${kind}`} aria-hidden="true">
    {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ left: `${10 + (i * 19) % 83}%`, top: `${15 + (i * 13) % 69}%`, animationDelay: `${i * .045}s`, rotate: `${i * 36}deg` }} />)}
  </span>;
}
