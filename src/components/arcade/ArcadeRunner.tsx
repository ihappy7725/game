/** 두 게임에서 같은 캐릭터의 후면·측면 4프레임 시트를 사용합니다. */
export function ArcadeRunner({ running = true, facing = "side", airborne = false }: { running?: boolean; facing?: "back" | "side"; airborne?: boolean }) {
  return <span aria-hidden="true" className={`arcade-runner-art runner-sprite runner-${facing} ${running ? "is-running" : ""} ${airborne ? "is-airborne" : ""}`} />;
}
