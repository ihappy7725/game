import { test, expect, type Page } from "./fixtures";
import { popLegalMove, swapPop, type PopBoard } from "../src/lib/word-pop";
import { POP_RECORD_KEY, parsePopRecords, rankPopRecords } from "../src/lib/pop-records";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
});
async function startPop(page: Page) {
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000));
  await page.getByRole("button", { name: "워드 팝 시작", exact: true }).click();
}
const board = (page: Page): Promise<PopBoard> => page.locator(".pop-tile").evaluateAll(els => els.map(el => ({ kind: Number((el as HTMLElement).dataset.kind), special: el.textContent?.includes("↔") ? "row" as const : el.textContent?.includes("★") ? "star" as const : undefined })));
async function settle(page: Page) {
  for (let i = 0; i < 18; i++) {
    if (["play", "stage", "over"].includes((await page.locator(".word-pop").getAttribute("data-phase"))!)) return;
    await page.clock.runFor(450);
  }
  throw new Error("교환 또는 연쇄가 끝나지 않았습니다.");
}

test("잘못된 교환도 이동 후 복원·힌트·정상 클릭 폭발·실제 드래그", async ({ page }) => {
  await startPop(page); const tiles = page.locator(".pop-tile"); const before = await board(page);
  let invalid: [number, number] | undefined;
  for (let a = 0; a < 48; a++) if (a % 7 !== 6 && before[a].kind !== before[a + 1].kind && !swapPop(before, a, a + 1)) { invalid = [a, a + 1]; break; }
  expect(invalid).toBeDefined();
  await tiles.nth(invalid![0]).click(); await expect(tiles.nth(invalid![0])).toHaveAttribute("aria-pressed", "true"); await tiles.nth(invalid![1]).click();
  await expect(page.locator(".word-pop")).toHaveAttribute("data-phase", "swap");
  expect(await tiles.nth(invalid![0]).evaluate(el => getComputedStyle(el).getPropertyValue("--pop-x"))).toBe("1");
  await settle(page); expect(await board(page)).toEqual(before); await expect(page.getByLabel("워드 팝 점수")).toHaveText("0점");
  await page.getByRole("button", { name: "힌트", exact: true }).click(); await expect(page.locator(".tile-hint")).toHaveCount(2);
  const move = popLegalMove(before)!; await tiles.nth(move[0]).click(); await tiles.nth(move[1]).click(); await page.clock.runFor(240);
  await expect(page.locator(".pop-sparks").first()).toBeVisible(); await expect(page.getByLabel("워드 팝 점수")).not.toHaveText("0점");
  await page.screenshot({ path: test.info().outputPath("pop-burst.png") }); await settle(page);
  if (await page.locator(".word-pop").getAttribute("data-phase") === "stage") { await page.getByRole("button", { name: "다음 스테이지" }).click(); }
  const next = popLegalMove(await board(page))!; const a = (await tiles.nth(next[0]).boundingBox())!; const b = (await tiles.nth(next[1]).boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down(); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 5 }); await page.mouse.up();
  await expect(page.locator(".word-pop")).toHaveAttribute("data-phase", "swap"); await settle(page);
});

test("목표 점수·스테이지 완료·시간 순위 저장·다음 단계·재접속 보존", async ({ page }) => {
  await startPop(page); const tiles = page.locator(".pop-tile");
  await expect(page.getByRole("progressbar", { name: "스테이지 목표 점수" })).toHaveAttribute("max", "1200");
  for (let i = 0; i < 30 && await page.locator(".word-pop").getAttribute("data-phase") === "play"; i++) {
    const move = popLegalMove(await board(page))!; await tiles.nth(move[0]).click(); await tiles.nth(move[1]).click(); await settle(page);
  }
  await expect(page.getByRole("heading", { name: "스테이지 1 클리어!" })).toBeVisible();
  const ranks = page.getByRole("region", { name: "워드 팝 시간 순위" }); await expect(ranks).toContainText("이번 기록");
  const raw = await page.evaluate(key => localStorage.getItem(key), POP_RECORD_KEY); const saved = parsePopRecords(raw); expect(saved).toHaveLength(1); expect(saved[0].elapsedMs).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath("pop-stage-clear.png") });
  await page.getByRole("button", { name: "다음 스테이지" }).click(); await expect(page.locator(".word-pop")).toHaveAttribute("data-stage", "2"); await expect(page.getByLabel("워드 팝 점수")).toHaveText("0점");
  await expect(page.getByRole("progressbar", { name: "스테이지 목표 점수" })).toHaveAttribute("max", "2000");
  await page.getByRole("button", { name: "일시정지", exact: true }).click(); const time = await page.getByLabel("워드 팝 남은 시간").textContent(); await page.clock.fastForward(5000); await expect(page.getByLabel("워드 팝 남은 시간")).toHaveText(time!);
  await page.reload(); expect(await page.evaluate(key => localStorage.getItem(key), POP_RECORD_KEY)).toBe(raw);
});

test("시간 순위는 단계와 난이도 분리·오염된 저장 값 제외", () => {
  const record = { stage: 1, difficulty: 0, elapsedMs: 20_000, score: 1500, at: 1 };
  const parsed = parsePopRecords(JSON.stringify([record, { ...record, elapsedMs: 7000 }, { ...record, stage: 2, score: 2200 }, { ...record, difficulty: 1, score: 2000 }, { ...record, elapsedMs: -1 }, { ...record, score: 0 }, null]));
  expect(parsed).toHaveLength(4); expect(rankPopRecords(parsed, 1, 0).map(r => r.elapsedMs)).toEqual([7000, 20_000]); expect(parsePopRecords("broken")).toEqual([]);
});

test("첫 방문 소리 기본 켜짐·실제 전체화면과 해제 후 재진입 방지", async ({ page }) => {
  await page.goto("/"); await expect(page.getByRole("button", { name: "소리 끄기", exact: true })).toBeVisible();
  await expect(page.getByText("API 연결됨")).toHaveCount(0); await expect(page.locator(".scenery-toggle")).toHaveCount(0);
  await page.getByRole("button", { name: "공부 모드", exact: true }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.keyboard.press("Escape"); await expect(page.getByRole("button", { name: "전체화면으로 보기" })).toBeVisible();
  await page.getByRole("button", { name: "아케이드 모드", exact: true }).click(); expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole("button", { name: "전체화면으로 보기" }).click(); await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  await page.getByRole("button", { name: "메모리 카드", exact: true }).click(); await page.evaluate(() => document.exitFullscreen()); await expect(page.getByRole("region", { name: "전체 화면 게임" })).toHaveCount(0);
});

test("홈·게임 영상 다섯 개 디코딩·무음·게임 종료 정리·작은 화면", async ({ page }) => {
  await page.goto("/"); const home = page.locator(".learning-hub>.landmark-scene video");
  for (const [mode, src] of [["아케이드 모드", "arcade"], ["공부 모드", "study"]]) {
    await page.getByRole("button", { name: mode, exact: true }).click(); await expect(home).toHaveAttribute("src", `/backgrounds/${src}-loop.mp4`);
    await expect.poll(() => home.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(.1); expect(await home.evaluate(el => (el as HTMLVideoElement).videoWidth)).toBe(1280);
  }
  await page.getByRole("button", { name: "아케이드 모드", exact: true }).click();
  for (const [name, src] of [["옐로캡 러시", "cab"], ["메모리 카드", "memory"], ["워드 팝", "pop"]]) {
    await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name, exact: true }).click(); const video = page.locator(".game-backdrop video");
    await expect(video).toHaveAttribute("src", `/backgrounds/${src}-loop.mp4`); await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
    expect(await video.evaluate(el => (el as HTMLVideoElement).muted && (el as HTMLVideoElement).loop)).toBe(true);
    await expect.poll(() => home.evaluate(el => (el as HTMLVideoElement).paused)).toBe(true); await page.getByRole("button", { name: "게임 나가기 Esc" }).click(); await expect(page.locator(".game-backdrop")).toHaveCount(0);
  }
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: "reduce" });
  const pop = page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }); await pop.scrollIntoViewIfNeeded(); await pop.click(); await page.getByRole("button", { name: "워드 팝 시작" }).click();
  for (const tile of await page.locator(".pop-tile").all()) await expect(tile).toBeInViewport();
  await expect(page.getByRole("button", { name: "힌트", exact: true })).toBeInViewport(); await page.screenshot({ path: test.info().outputPath("pop-mobile.png") });
});

test("메모리 오답 없음과 API 오류 모두 영상 위 중앙 안내·예제 진입", async ({ page }) => {
  await page.goto("/login"); await page.getByLabel("이메일", { exact: true }).fill("learner@example.test"); await page.getByLabel("비밀번호").fill("local-test-password"); await page.getByRole("button", { name: "로그인", exact: true }).click(); await expect(page).toHaveURL(/\/history$/);
  for (const error of [false, true]) {
    await page.route("**/api/game/mistakes?**", route => error ? route.fulfill({ status: 404, json: { detail: "Not Found" } }) : route.fulfill({ json: { items: [] } }));
    await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }).click(); const lobby = page.getByRole("region", { name: "메모리 카드 대기실" });
    await expect(lobby.getByRole("button", { name: "예제 카드 연습" })).toBeVisible(); await expect(lobby).toContainText(error ? "최신 main.py" : "아직 복습할 오답이 없어요");
    const panel = page.locator(".memory-lobby-panel"); expect(await panel.evaluate(el => getComputedStyle(el).textAlign)).toBe("center");
    await expect(page.locator(".game-backdrop")).toHaveAttribute("data-scene-kind", "video"); await page.screenshot({ path: test.info().outputPath(error ? "memory-error.png" : "memory-empty.png") });
    await lobby.getByRole("button", { name: "예제 카드 연습" }).click(); await expect(page.getByRole("button", { name: "플래시카드 시작" })).toBeVisible();
  }
});
