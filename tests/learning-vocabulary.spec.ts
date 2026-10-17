import { test, expect, type Page } from "./fixtures";
import { VOCAB } from "../src/lib/vocab";
import { parseLearning, unlockedDifficulty } from "../src/lib/learning-progress";
import { cabDuration, memoryDuration, missionDuration, popAnimationMs } from "../src/lib/game-tempo";
import { forkDuration, wordChoices } from "../src/lib/word-arcade";

test.use({ chooseBeginner: false });
test.beforeEach(async ({ context }) => { await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); }); });
async function enter(page: Page, name: string, difficulty = "초급") {
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name, exact: true }).click();
  await page.getByRole("button", { name: `${difficulty} 시작`, exact: true }).click();
}
async function library(page: Page) { await page.getByRole("button", { name: "학습한 단어량 열기" }).click(); return page.getByRole("dialog", { name: "학습한 단어량", exact: true }); }
async function rememberCards(page: Page, count: number) {
  await page.getByRole("button", { name: "플래시카드 시작", exact: true }).click();
  for (let i = 0; i < count; i++) { await page.getByRole("button", { name: "정답 뒤집기", exact: true }).click(); await page.getByRole("button", { name: "기억했어요", exact: true }).click(); }
  await expect(page.getByRole("heading", { name: "오늘의 복습 완료" })).toBeVisible();
}

test("직접 작성 어휘·예문과 오염된 저장 값·해제 조건·모든 게임 가속 하한", () => {
  expect(VOCAB.length).toBe(4000); expect(new Set(VOCAB.map(v => v.word)).size).toBe(VOCAB.length);
  for (const v of VOCAB) { expect(v.example.length).toBeGreaterThan(20); expect(v.meaning.length).toBeGreaterThan(0); expect(new Set([v.synonym, ...v.decoys]).size).toBe(3); }
  const record = parseLearning(JSON.stringify({ learned: ["abundant", "abundant", "invalid-entry", 5], stages: { cab: [1, 2, 0], fork: [0, -1, null] } }));
  expect(record.learned).toEqual(["abundant"]); expect(unlockedDifficulty(record, "cab")).toBe(2); expect(unlockedDifficulty(record, "fork")).toBe(0); expect(parseLearning("broken").learned).toEqual([]);
  expect(cabDuration(0, 0, false)).toBeGreaterThan(cabDuration(0, 12, false)); expect(forkDuration(0, 0)).toBeGreaterThan(forkDuration(0, 12));
  expect(memoryDuration(0, 0)).toBeGreaterThan(memoryDuration(0, 5)); expect(missionDuration(0, 0, 1)).toBeGreaterThan(missionDuration(0, 4, 1)); expect(popAnimationMs(0, 1, 420)).toBeGreaterThan(popAnimationMs(4, 2, 420));
  expect(cabDuration(2, 999, true)).toBeGreaterThanOrEqual(850); expect(memoryDuration(2, 999)).toBe(3500);
  const options = wordChoices({ ...VOCAB[0], synonym: "많은", decoys: ["작은", "느린"] }, 3);
  expect(new Set(options.choices).size).toBe(3); expect(options.choices.every(word => /^[a-z][a-z '-]*$/i.test(word))).toBe(true); expect(options.choices[options.correct]).toBe(VOCAB[0].word);
  const random = Math.random;
  try { Math.random = () => 0; const fixed = wordChoices(VOCAB[0], 3); expect(new Set(fixed.choices).size).toBe(3); expect(fixed.choices[fixed.correct]).toBe(VOCAB[0].word); }
  finally { Math.random = random; }

});

test("100단어 블록·예문·플래시카드·중복 없는 학습량·재접속 저장·중앙 고정 창", async ({ page }) => {
  let writes = 0; await page.route("**/api/**", route => { if (route.request().method() === "POST") writes++; return route.continue(); });
  await page.goto("/"); const dialog = await library(page); await expect(dialog.locator(".vocab-blocks button")).toHaveCount(40);
  for (const block of ["단어 블록 4", "단어 블록 40"]) await expect(dialog.getByRole("button", { name: block, exact: true })).toBeEnabled();
  await dialog.getByRole("button", { name: "단어 블록 1", exact: true }).click(); await expect(dialog.locator(".vocab-word-list li")).toHaveCount(100);
  await dialog.getByRole("button", { name: "플래시카드 시작" }).click(); await dialog.getByRole("button", { name: "단어 정답 뒤집기" }).click(); await expect(dialog).toContainText(VOCAB[0].example);
  await dialog.getByRole("button", { name: "기억했어요", exact: true }).click(); await expect(dialog.getByRole("progressbar", { name: "단어장 전체 학습량" })).toHaveAttribute("value", "1");
  await page.getByRole("button", { name: "패널 닫기" }).click(); await page.reload();
  await expect(page.getByRole("progressbar", { name: "전체 단어 학습량", exact: true })).toHaveAttribute("value", "1");
  const again = await library(page); const box = (await again.boundingBox())!; expect(box.x + box.width / 2).toBeCloseTo(640, 0);
  await again.getByRole("button", { name: "단어 블록 1", exact: true }).click(); await again.getByRole("button", { name: "플래시카드 시작" }).click(); await again.getByRole("button", { name: "단어 정답 뒤집기" }).click(); await again.getByRole("button", { name: "기억했어요", exact: true }).click();
  await expect(again.getByRole("progressbar", { name: "단어장 전체 학습량" })).toHaveAttribute("value", "1"); expect(writes).toBe(0); await page.screenshot({ path: test.info().outputPath("vocabulary-card.png") });
});

test("게임별 초급만 시작·메모리 클리어로 중급/고급 해제·게임 정답 학습량 연동", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/"); await enter(page, "메모리 카드"); await rememberCards(page, 6); await page.keyboard.press("Escape");
  await expect(page.getByRole("progressbar", { name: "전체 단어 학습량", exact: true })).toHaveAttribute("value", "6");
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click(); await expect(page.getByRole("button", { name: "중급 시작" })).toBeDisabled(); await page.keyboard.press("Escape");
  await enter(page, "메모리 카드", "중급"); await rememberCards(page, 12); await page.keyboard.press("Escape");
  await page.reload(); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }).click(); await expect(page.getByRole("button", { name: "고급 시작" })).toBeEnabled();
  await expect(page.locator(".game-topline")).toHaveCount(0); await page.screenshot({ path: test.info().outputPath("difficulty-unlocked.png") });
});

test("기억 시간 초과는 학습 집계 제외·정지/재개와 가속", async ({ page }) => {
  await page.goto("/"); await enter(page, "메모리 카드"); await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000));
  await page.getByRole("button", { name: "플래시카드 시작" }).click(); await page.getByRole("button", { name: "일시정지", exact: true }).click(); await page.clock.fastForward(30_000); await expect(page.getByRole("button", { name: "정답 뒤집기" })).toBeDisabled();
  await page.getByRole("button", { name: "계속하기" }).click(); await page.clock.fastForward(16_100); await expect(page.getByRole("button", { name: "기억했어요", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "다시 볼게요" }).click(); await expect(page.locator(".memory-tempo")).toContainText("16초"); await page.keyboard.press("Escape");
  await expect(page.getByRole("progressbar", { name: "전체 단어 학습량", exact: true })).toHaveAttribute("value", "0");
});

test("320px 단어장·잠금 화면 접근", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.goto("/");
  const dialog = await library(page); await expect(dialog.getByRole("button", { name: "단어 블록 1", exact: true })).toBeInViewport(); await page.getByRole("button", { name: "패널 닫기" }).click();
  const launch = page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }); await launch.scrollIntoViewIfNeeded(); await launch.click();
  await expect(page.getByRole("button", { name: "초급 시작" })).toBeInViewport(); await expect(page.getByRole("button", { name: "고급 시작" })).toBeDisabled(); await page.screenshot({ path: test.info().outputPath("difficulty-mobile.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
