import { expect, test, type Page } from "@playwright/test";
import { clearPop, freshPopBoard, popLegalMove, popMatches, swapPop, type PopBoard } from "../src/lib/word-pop";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
});
const base = (): PopBoard => Array.from({ length: 49 }, (_, i) => ({ kind: (i % 7 + Math.floor(i / 7)) % 6 }));
test("보드는 초기 매치 없이 교환 가능·행 끝끼리 교환 금지", () => {
  for (const random of [() => 0, () => .999, Math.random]) { const board = freshPopBoard(random); expect(board).toHaveLength(49); expect(popMatches(board)).toHaveLength(0); expect(popLegalMove(board)).not.toBeNull(); }
  expect(swapPop(base(), 6, 7)).toBeNull(); expect(swapPop(base(), -1, 0)).toBeNull();
});
test("4/5개 매치의 줄/별 폭탄·중력·폭탄 연쇄", () => {
  const four = base(); [0, 1, 2, 3].forEach(i => four[i] = { kind: 0 });
  const row = clearPop(four, popMatches(four), [], 1, () => .9); expect(row.special).toBe("row"); expect(row.board.some(t => t.special === "row")).toBe(true); expect(row.cleared).not.toContain(1);
  const five = base(); [0, 1, 2, 3, 4].forEach(i => five[i] = { kind: 2 }); expect(clearPop(five, popMatches(five), [], 2).special).toBe("star");
  const bombs = base(); bombs[7] = { kind: 0, special: "row" }; bombs[10] = { kind: 3, special: "star" };
  const result = clearPop(bombs, [], [7]); for (let i = 7; i < 14; i++) expect(result.cleared).toContain(i); expect(result.cleared.length).toBeGreaterThan(7); expect(result.board).toHaveLength(49);
  const gravity = base(); [0, 7, 14].forEach(i => gravity[i] = { kind: 0 }); const after = clearPop(gravity, popMatches(gravity)); expect(after.board[42].kind).toBe(gravity[42].kind); expect(after.board[21].kind).toBe(gravity[21].kind);
});
async function start(page: Page) {
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click();
  await page.clock.install({time:new Date(0)}); await page.clock.pauseAt(new Date(1000)); await page.getByRole("button", { name: "워드 팝 시작", exact: true }).click();
}
test("실제 보드 교환·점수/효과음·일시정지·시간 종료와 재시작", async ({ page }) => {
  const cues: string[] = []; await page.exposeFunction("cueProbe", (cue: string) => cues.push(cue));
  await page.addInitScript(() => window.addEventListener("toefl-game-cue", e => (window as unknown as { cueProbe: (s: string) => void }).cueProbe((e as CustomEvent).detail)));
  await start(page); const buttons = page.locator(".pop-tile"); await expect(buttons).toHaveCount(49);
  const board = await buttons.evaluateAll(elements => elements.map(el => ({ kind: Number(el.className.match(/tile-(\d)/)![1]) })));
  const move = popLegalMove(board)!; expect(move).not.toBeNull(); await buttons.nth(move[0]).click(); await buttons.nth(move[1]).click(); await expect(page.locator(".word-pop")).toHaveAttribute("data-phase", "swap"); await page.clock.fastForward(230);
  await expect(page.getByLabel("워드 팝 점수")).not.toHaveText("0점"); expect(cues.some(cue => ["pop", "correct"].includes(cue))).toBe(true);
  for (let i = 0; i < 15 && await buttons.first().isDisabled(); i++) await page.clock.fastForward(450);
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); const time = await page.getByLabel("워드 팝 남은 시간").textContent(); await page.clock.fastForward(60_000); await expect(page.getByLabel("워드 팝 남은 시간")).toHaveText(time!); await expect(buttons.first()).toBeDisabled();
  await page.getByRole("button", { name: "계속 팝", exact: true }).click(); await page.clock.fastForward(61_000); await expect(page.getByRole("heading", { name: "오늘의 팝 타임 끝!" })).toBeVisible(); await expect(page.getByLabel("게임 결과 연출")).toBeVisible();
  await page.getByRole("button", { name: "다시 팝!", exact: true }).click(); await expect(page.getByLabel("워드 팝 점수")).toHaveText("0점"); await page.keyboard.press("Escape"); await expect(page.getByRole("region", { name: "전체 화면 게임" })).toHaveCount(0);
});
test("메모리 자가 정답 소리·아쉬운 결과·브라우저 신기록 축하", async ({ page }) => {
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }).click();
  await page.getByRole("button", { name: "플래시카드 시작", exact: true }).click();
  for (let i = 0; i < 6; i++) { await page.getByRole("button", { name: "정답 뒤집기", exact: true }).click(); await page.getByRole("button", { name: "다시 볼게요", exact: true }).click(); }
  await expect(page.locator(".outcome-sad")).toBeVisible(); await expect(page.locator(".outcome-dim")).toHaveCSS("animation-name", "outcome-darken");
  await page.getByRole("button", { name: "다시 복습", exact: true }).click(); await page.getByRole("button", { name: "플래시카드 시작", exact: true }).click();
  for (let i = 0; i < 6; i++) { await page.getByRole("button", { name: "정답 뒤집기", exact: true }).click(); await page.getByRole("button", { name: "기억했어요", exact: true }).click(); }
  await expect(page.locator(".outcome-good")).toContainText("개인 신기록"); await expect(page.locator(".outcome-good .outcome-burst>span")).toHaveCount(18); expect(await page.evaluate(() => localStorage.getItem("toefl-best-v1:cards:0"))).toBe("600");
});
test("게임 실제 영상 이동·정지와 영상 파일 실패 포스터", async ({ page }) => {
  await page.goto("/"); const scene = page.locator(".learning-hub>.landmark-scene"); await expect(scene).toHaveAttribute("data-scene-kind", "video"); await expect(scene.locator(".scene-plane")).toHaveCount(0);
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click(); await page.getByRole("button", { name: "절벽 달리기 시작", exact: true }).click();
  const video = page.locator(".game-backdrop video");
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(.05);
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).paused)).toBe(true);
  const paused = await video.evaluate(el => (el as HTMLVideoElement).currentTime); await page.waitForTimeout(300); expect(await video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBe(paused); await page.keyboard.press("Escape");
  await page.route("**/backgrounds/scene-videos.json", route => route.fulfill({ json: { arcade: "/backgrounds/invalid.mp4" } })); await page.route("**/backgrounds/invalid.mp4", route => route.fulfill({ contentType: "video/mp4", body: "invalid" })); await page.reload(); await expect(scene).toHaveAttribute("data-scene-kind", "poster");
});
