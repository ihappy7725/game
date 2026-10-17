import { expect, test, type Page } from "./fixtures";
import { VOCAB } from "../src/lib/vocab";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && ["3000", "3101"].includes(url.port) ? route.continue() : route.abort();
  });
});

async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("learner@example.test");
  await page.getByLabel("비밀번호").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /게임 정보: JFK 입국자/ })).toBeVisible();
}

async function startCab(page: Page) {
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: /옐로캡 러시/ }).click();
  await page.clock.install();
  await page.getByRole("button", { name: "출발하기" }).click();
}

async function answer(page: Page, correct: boolean) {
  const field = page.getByLabel("택시 게임 조작 영역", { exact: true });
  const word = await field.locator("p.text-3xl").textContent();
  const item = VOCAB.find((v) => v.word === word);
  if (!item) throw new Error("출제 단어를 찾지 못했습니다.");
  const candidate = correct ? item.synonym : item.decoys[0];
  await field.getByRole("button", { name: new RegExp(`번 차선: ${candidate}$`) }).click();
  await page.clock.fastForward(3001);
  await expect(field.getByText(correct ? /^정답!/ : /^아쉽습니다\./)).toBeVisible();
  await page.clock.fastForward(901);
}

test("모의 JWT를 Bearer로 전송·서버 보상 표시·오답 순서·중복 저장 차단", async ({ page }) => {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  let balance = 150;
  await page.route("http://localhost:3101/api/game/**", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/state")) {
      const response = await route.fetch();
      const body = await response.json();
      return route.fulfill({ json: { ...body, coin_balance: balance } });
    }
    if(route.request().method() === "GET") return route.continue();
    const body = route.request().postDataJSON();
    requests.push({ path, body });
    if (path.endsWith("/coins")) {
      balance = 173;
      return route.fulfill({ json: { awarded: 23, requested: 27, capped: true, daily_remaining: 0, coin_balance: balance, xp: 80, streak_days: 1, tier: { name: "JFK 입국자" } } });
    }
    return body.was_correct ? route.fulfill({ status: 404, json: { detail: "기록에 없는 문제입니다." } }) : route.fulfill({ json: { id: "local-mistake" } });
  });
  await login(page);
  await startCab(page);
  await answer(page, true);
  for (let i = 0; i < 3; i++) await answer(page, false);
  await expect(page.getByText("운행 종료", { exact: true })).toBeVisible();
  expect(requests).toHaveLength(0);
  const save = page.getByRole("button", { name: "보상·오답 저장", exact: true });
  await save.dblclick();
  await expect(page.getByText(/23코인 지급.*일일 코인 상한 적용/)).toBeVisible();
  await expect(page.getByText(/오답·복습 기록을 반영했습니다/)).toBeVisible();
  expect(requests.filter((r) => r.path.endsWith("/coins"))).toEqual([{ path: "/api/game/coins", body: { reason: "vocab_game", score: 110, correct_count: 1 } }]);
  const answers = requests.filter((r) => r.path.endsWith("/mistakes"));
  expect(answers.map((r) => r.body.was_correct)).toEqual([true, false, false, false]);
  expect(answers.every((r) => r.body.source === "vocab" && typeof r.body.chosen === "string")).toBe(true);
  await page.clock.resume();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /게임 정보: JFK 입국자 · 173 코인/ })).toBeVisible();
  await page.getByRole("button", { name: /게임 정보: JFK 입국자/ }).click();
  await expect(page.getByRole("region", { name: "내 게임 정보" }).getByText(/맨해튼 유학생까지/)).toBeVisible();
  await page.getByRole("button", { name: "게임 정보 닫기" }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await expect(page.getByRole("button", { name: /게임 정보: 로그인하면/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "로그인", exact: true })).toHaveCount(0);
  await expect(page.getByRole("link",{name:"로그인",exact:true})).toBeVisible();
});

test("게스트 연습은 게임 API를 호출하지 않음", async ({ page }) => {
  let calls = 0;
  await page.route("http://localhost:3101/api/game/**", (route) => { calls += 1; return route.abort(); });
  await page.goto("/");
  await startCab(page);
  for (let i = 0; i < 3; i++) await answer(page, false);
  await expect(page.getByText(/비로그인 연습 판은 저장하지 않습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: "보상·오답 저장", exact: true })).toHaveCount(0);
  expect(calls).toBe(0);
});

test("지급 응답 유실 시 재지급 없이 안내하고 오답은 별도로 저장", async ({ page }) => {
  let rewards = 0;
  let mistakes = 0;
  await page.route("http://localhost:3101/api/game/coins", (route) => { rewards += 1; return route.abort(); });
  await page.route("http://localhost:3101/api/game/mistakes", (route) => { mistakes += 1; return route.fulfill({ json: {} }); });
  await login(page);
  await startCab(page);
  for (let i = 0; i < 3; i++) await answer(page, false);
  await page.getByRole("button", { name: "보상·오답 저장", exact: true }).click();
  await expect(page.getByText(/보상 처리 여부를 게임 정보에서 확인/)).toBeVisible();
  await expect(page.getByRole("button", { name: "저장 요청 종료" })).toBeDisabled();
  expect(rewards).toBe(1);
  expect(mistakes).toBe(3);
});

test("게임 상태 401·404·503·서버 오류를 잔액 0으로 표시하지 않음", async ({ page }) => {
  let status = 401;
  await page.route("http://localhost:3101/api/game/state", (route) => route.fulfill({ status, json: { detail: "모의 조회 실패" } }));
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("learner@example.test");
  await page.getByLabel("비밀번호").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await page.goto("/");
  await expect(page.getByRole("button", { name: /게임 정보: 세션이 만료/ })).toBeVisible();
  await page.getByRole("button", { name: /게임 정보: 세션이 만료/ }).click();
  status = 503;
  await page.getByRole("button", { name: "게임 정보 새로고침" }).click();
  await expect(page.getByRole("region", { name: "내 게임 정보" }).getByText("게임 서버 설정을 확인해 주세요.")).toBeVisible();
  status = 502;
  await page.getByRole("button", { name: "게임 정보 새로고침" }).click();
  await expect(page.getByRole("region", { name: "내 게임 정보" }).getByText("모의 조회 실패")).toBeVisible();
  status = 404;
  await page.getByRole("button", { name: "게임 정보 새로고침" }).click();
  await expect(page.getByRole("region", { name: "내 게임 정보" }).getByText(/실행 중인 백엔드에 게임 API가 없습니다/)).toBeVisible();
  await expect(page.getByRole("button", { name: /게임 정보:.*0 코인/ })).toHaveCount(0);
});
