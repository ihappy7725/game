// 사용자가 직접 실행한 전용 창만 제어하며 일반 브라우저 설정은 바꾸지 않습니다.
export async function attachDesktopWindow(context, page) {
  const session = await context.newCDPSession(page);
  const { windowId } = await session.send("Browser.getWindowForTarget");
  await session.send("Browser.setWindowBounds", { windowId, bounds: { windowState: "fullscreen" } });
  await context.exposeBinding("__toeflSetFullscreen", async ({ page: source }, active) => {
    if (source !== page || new URL(source.url()).origin !== "http://localhost:3000" || typeof active !== "boolean") throw new Error("허용되지 않은 창 요청입니다.");
    await session.send("Browser.setWindowBounds", { windowId, bounds: { windowState: active ? "fullscreen" : "normal" } });
    return active;
  });
  await context.addInitScript(() => {
    if (location.origin !== "http://localhost:3000") return;
    window.toeflDesktop = {
      fullscreen: sessionStorage.getItem("toefl-desktop-fullscreen") !== "false",
      async setFullscreen(active) {
        const value = await window.__toeflSetFullscreen(active);
        window.toeflDesktop.fullscreen = value;
        sessionStorage.setItem("toefl-desktop-fullscreen", String(value));
        window.dispatchEvent(new Event("toefl-desktop-fullscreen"));
      },
    };
  });
  return session;
}
