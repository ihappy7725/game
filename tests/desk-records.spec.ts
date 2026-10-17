import { test, expect, type Page } from "./fixtures";
import { popLegalMove, type PopBoard } from "../src/lib/word-pop";

test.use({ hasTouch: true });
test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
});
async function login(page: Page) {
  await page.goto("/login"); await page.getByLabel("이메일", { exact: true }).fill("learner@example.test"); await page.getByLabel("비밀번호").fill("local-test-password"); await page.getByRole("button", { name: "로그인", exact: true }).click(); await expect(page).toHaveURL(/\/history$/); await page.goto("/");
}
const item = { item_id: "brass_lamp", name: "황동 스탠드", emoji: "💡", rarity: "rare", description: "나의 조명", quantity: 3, placed: true, placed_x: 30, placed_y: 50 };

test("밝은 책상 실제 드래그·방향키·경계 제한·명시적 저장", async ({ page }) => {
  const placed = { ...item }; const writes: unknown[] = [];
  await page.route("**/api/game/inventory", route => route.fulfill({ json: { items: [placed] } }));
  await page.route("**/api/game/inventory/place", route => { const body = route.request().postDataJSON(); writes.push(body); Object.assign(placed, { placed: body.placed, placed_x: body.x, placed_y: body.y }); return route.fulfill({ json: placed }); });
  await login(page); await page.getByRole("button", { name: "나의 책상 꾸미기", exact: true }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveCSS("color-scheme", "light"); const object = dialog.getByRole("button", { name: "황동 스탠드 위치 편집" }); await expect(object.locator("svg")).toHaveCount(1);
  const area = (await page.getByLabel("책상 배치 영역").boundingBox())!; const box = (await object.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + area.width * .2, box.y + box.height / 2 + area.height * .1, { steps: 8 }); await page.mouse.up();
  await expect(dialog.getByRole("slider", { name: /가로 위치/ })).toHaveValue("50"); await expect(dialog.getByRole("slider", { name: /세로 위치/ })).toHaveValue("60"); expect(writes).toHaveLength(0);
  await object.focus(); await page.keyboard.press("Shift+ArrowRight"); await expect(dialog.getByRole("slider", { name: /가로 위치/ })).toHaveValue("60");
  await dialog.getByRole("button", { name: "배치 저장", exact: true }).click(); await expect(dialog.getByText("책상 배치를 저장했습니다.")).toBeVisible(); expect(writes).toEqual([{ item_id: "brass_lamp", placed: true, x: 60, y: 60 }]);
  await expect(object).toBeEnabled(); await object.focus(); await expect(object).toBeFocused(); for (let i = 0; i < 7; i++) await page.keyboard.press("Shift+ArrowRight"); await expect(dialog.getByRole("slider", { name: /가로 위치/ })).toHaveValue("100");
  const boundary = (await page.getByLabel("책상 배치 미리보기").boundingBox())!; const edge = (await object.boundingBox())!; expect(edge.x + edge.width).toBeLessThan(boundary.x + boundary.width); await page.screenshot({ path: test.info().outputPath("desk-drag.png") });
});

test("320px 실제 터치 드래그·중복 보관 안내와 뽑기 결과", async ({ page }) => {
  test.setTimeout(90_000);
  const owned = { ...item }; await page.route("**/api/game/inventory", route => route.fulfill({ json: { items: [owned] } }));
  await page.route("**/api/game/state", async route => { const data = await (await route.fetch()).json(); return route.fulfill({ json: { ...data, coin_balance: 900 } }); });
  let draws = 0; await page.route("**/api/game/gacha?**", route => { draws++; owned.quantity = 4; return route.fulfill({ json: { items: [{ id: owned.item_id, name: owned.name, emoji: owned.emoji, rarity: owned.rarity, quantity: 4 }], cost: 300, coin_balance: 600 } }); });
  await login(page); await page.setViewportSize({ width: 320, height: 568 }); await page.getByRole("button", { name: "나의 책상 꾸미기", exact: true }).click(); const dialog = page.getByRole("dialog");
  const object = dialog.getByRole("button", { name: "황동 스탠드 위치 편집" }); await object.scrollIntoViewIfNeeded(); const box = (await object.boundingBox())!; const session = await page.context().newCDPSession(page);
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] }); await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x + 30, y: point.y + 10 }] }); await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(dialog.getByRole("slider", { name: /가로 위치/ })).not.toHaveValue("30");
  await dialog.getByRole("button", { name: "아이템 뽑기", exact: true }).click(); await expect(dialog.getByText(/같은 아이템이 나오면 보유 수량/)).toBeVisible();
  await dialog.getByRole("button", { name: "뽑기 선택", exact: true }).click(); expect(draws).toBe(0); await dialog.getByRole("button", { name: "코인 사용하고 뽑기", exact: true }).click();
  await expect(dialog.getByText("중복도 수량으로 보관했어요")).toBeVisible(); await expect(dialog.getByText(/희귀 · 보유 4개/)).toBeVisible(); expect(draws).toBe(1); await page.screenshot({ path: test.info().outputPath("gacha-mobile.png") });
});

test("학습 코인과 게임 순위 분리·난이도/단계 전송·빈 목록과 오류 구분", async ({ page }) => {
  const queries: string[] = []; let failed = false;
  await page.route("**/api/game/leaderboard?**", route => route.fulfill({ json: { rows: [{ rank: 1, display_name: "학습 코인 기록", earned_this_week: 500, is_me: true }], my_rank: 1 } }));
  await page.route("**/api/game/records/leaderboard?**", route => {
    const u = new URL(route.request().url()); queries.push(u.search);
    return failed ? route.fulfill({ status: 503, json: { detail: "기록 테이블 미적용" } }) : route.fulfill({ json: { rows: u.searchParams.get("game_id") === "pop" ? [{ rank: 1, display_name: "유니온 abc123", score: 5000, elapsed_ms: 8500, is_me: false }, { rank: 2, display_name: "유니온 def456", score: 5500, elapsed_ms: 12000, is_me: true }] : [], my_rank: u.searchParams.get("game_id") === "pop" ? 2 : null, verification: "client_reported" } });
  });
  await login(page); await page.getByRole("complementary", { name: "나의 도구" }).getByRole("button", { name: "주간 랭킹" }).click(); const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("학습 코인 기록 (나)")).toBeVisible(); await dialog.getByRole("button", { name: "게임 기록", exact: true }).click(); await expect(dialog.getByText(/아직 이번 주 게임 기록이 없습니다/)).toBeVisible();
  await dialog.getByRole("button", { name: "워드 팝", exact: true }).click(); await expect(dialog.getByRole("list", { name: "이번 주 게임 순위" })).toContainText("8.50초"); await expect(dialog.getByText("내 게임 순위 2위")).toBeVisible();
  await dialog.getByLabel("난이도", { exact: true }).selectOption("2"); await dialog.getByLabel("스테이지", { exact: true }).selectOption("3"); await expect.poll(() => queries.at(-1)).toContain("difficulty=2&stage=3");
  await expect(dialog.getByRole("list", { name: "이번 주 게임 순위" }).getByRole("listitem").last()).toHaveAttribute("aria-current", "true"); await page.screenshot({ path: test.info().outputPath("game-ranking.png") });
  failed = true; await dialog.getByRole("button", { name: "게임 순위 새로고침" }).click(); await expect(dialog.getByRole("alert")).toContainText("불러오지 못했어요"); await expect(dialog.getByText(/아직 이번 주 게임 기록이 없습니다/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "학습 코인", exact: true }).click(); await expect(dialog.getByText("학습 코인 기록 (나)")).toBeVisible();
});

test("갈림길 종료 후 기록 저장은 별도 버튼·동일 판 중복 차단·Bearer 사용", async ({ page }) => {
  const records: Record<string, unknown>[] = []; let rewards = 0;
  await page.route("**/api/game/coins", route => { rewards++; return route.fulfill({ json: {} }); });
  await page.route("**/api/game/records", route => { expect(route.request().headers().authorization).toMatch(/^Bearer /); records.push(route.request().postDataJSON()); return route.fulfill({ json: { saved: true, created: true, verification: "client_reported" } }); });
  await login(page); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000)); await page.getByRole("button", { name: "절벽 달리기 시작" }).click(); await page.clock.fastForward(3900); await page.clock.fastForward(800);
  const save = page.getByRole("button", { name: "주간 게임 기록 저장", exact: true }); await expect(save).toBeVisible(); expect(records).toHaveLength(0);
  await save.dblclick(); await expect(page.getByRole("button", { name: "게임 기록 저장 완료" })).toBeDisabled(); expect(records).toHaveLength(1); expect(records[0]).toMatchObject({ game_id: "fork", difficulty: 0, stage: 0, score: 0 }); expect(records[0].elapsed_ms).toBeGreaterThan(0); expect(records[0].run_id).toMatch(/^[0-9a-f-]{36}$/); expect(rewards).toBe(0);
});

test("워드 팝 시간 저장 실패 재시도는 동일 판·잘못된 오답 응답도 예제 진입", async ({ page }) => {
  test.setTimeout(90_000);
  const attempts: Record<string, unknown>[] = [];
  await page.route("**/api/game/records", route => { attempts.push(route.request().postDataJSON()); return attempts.length === 1 ? route.abort() : route.fulfill({ json: { saved: true, created: false, verification: "client_reported" } }); });
  await page.route("**/api/game/mistakes?**", route => route.fulfill({ json: { status: "잘못된 모의 응답" } }));
  await login(page); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000)); await page.getByRole("button", { name: "워드 팝 시작" }).click();
  const tiles = page.locator(".pop-tile");
  for (let i = 0; i < 30 && await page.locator(".word-pop").getAttribute("data-phase") === "play"; i++) {
    const board: PopBoard = await tiles.evaluateAll(els => els.map(el => ({ kind: Number((el as HTMLElement).dataset.kind), special: el.textContent?.includes("↔") ? "row" as const : el.textContent?.includes("★") ? "star" as const : undefined })));
    const move = popLegalMove(board)!; await tiles.nth(move[0]).click(); await tiles.nth(move[1]).click();
    for (let j = 0; j < 18 && !["play", "stage", "over"].includes((await page.locator(".word-pop").getAttribute("data-phase"))!); j++) await page.clock.runFor(450);
  }
  await expect(page.getByRole("heading", { name: "스테이지 1 클리어!" })).toBeVisible(); expect(attempts).toHaveLength(0);
  await page.getByRole("button", { name: "주간 게임 기록 저장", exact: true }).click(); await expect(page.getByRole("button", { name: "같은 게임 기록 다시 저장" })).toBeVisible();
  await page.getByRole("button", { name: "같은 게임 기록 다시 저장" }).click(); await expect(page.getByRole("button", { name: "게임 기록 저장 완료" })).toBeDisabled();
  expect(attempts).toHaveLength(2); expect(attempts[0]).toEqual(attempts[1]); expect(attempts[0]).toMatchObject({ game_id: "pop", stage: 1, difficulty: 0 }); expect(Number(attempts[0].elapsed_ms)).toBeLessThanOrEqual(60_000);
  await page.getByRole("button", { name: "게임 나가기 Esc" }).click(); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }).click();
  await expect(page.getByRole("region", { name: "메모리 카드 대기실" }).getByRole("alert")).toContainText("복습 기록 응답을 확인하지 못했어요"); await page.getByRole("button", { name: "예제 카드 연습" }).click(); await expect(page.getByRole("button", { name: "플래시카드 시작" })).toBeVisible();
});
