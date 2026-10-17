import { chromium } from "@playwright/test";
import { access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { attachDesktopWindow } from "./desktop-window.mjs";

async function main() {
  const url = "http://localhost:3000/";
  try { const response = await fetch(url, { signal: AbortSignal.timeout(5000) }); if (!response.ok) throw new Error(); }
  catch { throw new Error("홈 서버가 꺼져 있습니다. 다른 터미널에서 npm.cmd run dev를 먼저 실행하세요."); }
  let executablePath;
  for (const path of ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"]) {
    try { await access(path); executablePath = path; break; } catch { /* 다음 설치 브라우저를 확인합니다. */ }
  }
  if (!executablePath) throw new Error("설치된 Chrome 또는 Edge를 찾지 못했습니다.");
  const profile = fileURLToPath(new URL("../.local/game-browser", import.meta.url));
  const context = await chromium.launchPersistentContext(profile, { executablePath, headless: false, viewport: null, args: ["--start-fullscreen"] });
  try {
    const page = context.pages()[0] ?? await context.newPage();
    await attachDesktopWindow(context, page);
    page.on("close", () => { void context.close(); });
    await page.goto(url);
    console.log("토플 유니온 전용 전체화면 창을 열었습니다. Esc로 전체화면을 해제합니다. 종료는 창 닫기/Alt+F4입니다.");
  } catch (error) { await context.close(); throw error; }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
