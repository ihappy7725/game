import { test, expect, type Page } from "./fixtures";
import { VOCAB } from "../src/lib/vocab";
import { swapPop, type PopBoard } from "../src/lib/word-pop";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
});
async function cab(page: Page) {
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "옐로캡 러시", exact: true }).click();
  await page.getByRole("button", { name: "출발하기", exact: true }).click();
  const field = page.getByLabel("택시 게임 조작 영역", { exact: true });
  return { field, word: (await field.locator("p.text-3xl").textContent())! };
}

test("택시 정답만 학습 집계·게임 재진입 초반 단어 반복 완화·손님/로그인 기록 분리", async ({ page }) => {
  await page.goto("/"); await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000));
  const first = await cab(page), item = VOCAB.find(v => v.word === first.word)!;
  await first.field.getByRole("button", { name: new RegExp(`번 차선: ${item.synonym}$`) }).click(); await page.clock.fastForward(3010);
  await page.keyboard.press("Escape"); const graph = page.getByRole("progressbar", { name: "전체 단어 학습량", exact: true }); await expect(graph).toHaveAttribute("value", "1");
  const next = await cab(page); expect(next.word).not.toBe(first.word); await page.keyboard.press("Escape"); await expect(graph).toHaveAttribute("value", "1");
  await page.clock.resume(); await page.goto("/login"); await page.getByLabel("이메일", { exact: true }).fill("learner@example.test"); await page.getByLabel("비밀번호").fill("local-test-password"); await page.getByRole("button", { name: "로그인", exact: true }).click(); await expect(page).toHaveURL(/\/history$/); await page.goto("/");
  await expect(graph).toHaveAttribute("value", "0");
  await page.getByRole("button", { name: "학습한 단어량 열기" }).click(); const dialog = page.getByRole("dialog", { name: "학습한 단어량", exact: true });
  await dialog.getByRole("button", { name: "단어 블록 1", exact: true }).click(); await dialog.getByRole("button", { name: "플래시카드 시작" }).click(); await dialog.getByRole("button", { name: "단어 정답 뒤집기" }).click(); await dialog.getByRole("button", { name: "기억했어요", exact: true }).click(); await page.getByRole("button", { name: "패널 닫기" }).click();
  await expect(graph).toHaveAttribute("value", "1"); await page.getByRole("button", { name: "로그아웃", exact: true }).click(); await expect(graph).toHaveAttribute("value", "1");
  const records = await page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter(k => k.startsWith("toefl-learning-v1:")).map(k => [k, JSON.parse(localStorage.getItem(k)!)])));
  expect(Object.keys(records)).toHaveLength(2); expect(records["toefl-learning-v1:guest"].learned).toEqual([first.word]); expect(records["toefl-learning-v1:00000000-0000-4000-8000-000000000001"].learned).toEqual([VOCAB[0].word]);
});

test("워드 팝 한국어 미션 정답이 전체 어휘 학습 기록으로 연결", async ({ page }) => {
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000)); await page.getByRole("button", { name: "워드 팝 시작", exact: true }).click();
  let move: number[] | null = null;
  for (let attempt = 0; attempt < 10 && !move; attempt++) {
    const board: PopBoard = await page.locator(".pop-tile").evaluateAll(tiles => tiles.map(el => ({ kind: Number(el.getAttribute("data-kind")) })));
    for (let a = 0; a < 49 && !move; a++) for (const b of [a + 1, a + 7]) { if (b >= 49) continue; const result = swapPop(board, a, b); if (result && result.counts[0] >= 3) { move = [a, b]; break; } }
    if (!move) { await page.keyboard.press("Escape"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click(); await page.getByRole("button", { name: "워드 팝 시작", exact: true }).click(); }
  }
  expect(move).not.toBeNull(); const word = (await page.locator(".pop-tile[data-kind='0'] strong").first().textContent())!;
  await page.locator(".pop-tile").nth(move![0]).click(); await page.locator(".pop-tile").nth(move![1]).click(); await page.clock.fastForward(230);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("toefl-learning-v1:guest") ?? '{"learned":[]}').learned)).toEqual([word]);
  await page.keyboard.press("Escape"); await expect(page.getByRole("progressbar", { name: "전체 단어 학습량", exact: true })).toHaveAttribute("value", "1");
});

test("WebGL 미지원은 캔버스 맵으로 전환하고 게임을 닫을 수 있음", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: unknown[]) { return type.startsWith("webgl") ? null : Reflect.apply(original, this, [type, ...args]); } as typeof original;
  });
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click();
  await expect(page.locator(".fork-live-world")).toHaveAttribute("data-renderer", "fallback"); await expect(page.locator(".fork-canvas-world")).toBeVisible();
  await page.getByRole("button", { name: "절벽 달리기 시작", exact: true }).click(); await expect(page.getByLabel("갈림길 한국어 뜻")).toBeVisible(); await page.keyboard.press("Escape"); await expect(page.locator(".fork-live-world")).toHaveCount(0);
});
