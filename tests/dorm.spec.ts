import { expect, test, type Page } from "./fixtures";

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
async function openDorm(page: Page) {
  await page.getByRole("complementary", { name: "나의 도구" }).getByRole("button", { name: "나의 책상 꾸미기", exact: true }).click();
  return page.getByRole("dialog", { name: "나의 책상 꾸미기", exact: true });
}
const initialItem = { item_id: "lamp", name: "황동 스탠드", emoji: "💡", rarity: "rare", description: "책상을 밝히는 조명", quantity: 1, placed: false, placed_x: null as number | null, placed_y: null as number | null };

async function mockWorld(page: Page) {
  const state = { balance: 900, items: [{ ...initialItem }], mutations: [] as { path: string; body: unknown; count: number | null }[] };
  await page.route("http://localhost:3101/api/game/**", async (route) => {
    expect(route.request().headers().authorization).toMatch(/^Bearer .+/);
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/state")) {
      const body = await (await route.fetch()).json();
      return route.fulfill({ json: { ...body, coin_balance: state.balance } });
    }
    if (url.pathname.endsWith("/inventory")) return route.fulfill({ json: { items: state.items } });
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill({ json: {
      rows: [{ rank: 1, display_name: "꾸준한 유학생", earned_this_week: 1200, is_me: false }, { rank: 2, display_name: "나의 학습 기록", earned_this_week: 900, is_me: true }], my_rank: 2,
    } });
    const body = route.request().postData() ? route.request().postDataJSON() : null;
    const count = url.searchParams.has("count") ? Number(url.searchParams.get("count")) : null;
    state.mutations.push({ path: url.pathname, body, count });
    if (url.pathname.endsWith("/place")) {
      const item = state.items.find((item) => item.item_id === body.item_id)!;
      Object.assign(item, { placed: body.placed, placed_x: body.x, placed_y: body.y });
      return route.fulfill({ json: item });
    }
    if (url.pathname.endsWith("/gacha")) {
      state.balance -= 300 * count!;
      state.items[0].quantity += count!;
      return route.fulfill({ json: { items: Array.from({ length: count! }, () => ({ id: "lamp", name: "황동 스탠드", emoji: "💡", rarity: "rare", quantity: state.items[0].quantity })), cost: 300 * count!, coin_balance: state.balance } });
    }
    return route.fulfill({ status: 404, json: { detail: "모의 경로 없음" } });
  });
  return state;
}

test("보유 아이템 배치·최소화 편집 유지·창 재개방 후 저장 위치·치우기", async ({ page }) => {
  const world = await mockWorld(page);
  await login(page);
  let dorm = await openDorm(page);
  await dorm.getByRole("button", { name: /황동 스탠드 · 1개/ }).click();
  await dorm.getByLabel("책상에 배치", { exact: true }).check();
  await dorm.getByRole("slider", { name: /가로 위치/ }).press("Home");
  await dorm.getByRole("slider", { name: /세로 위치/ }).press("End");
  await dorm.getByRole("button", { name: "패널 닫기", exact: true }).click();
  dorm = await openDorm(page);
  await expect(dorm.getByRole("slider", { name: /가로 위치/ })).toHaveValue("0");
  await expect(dorm.getByRole("slider", { name: /세로 위치/ })).toHaveValue("100");
  await dorm.getByRole("button", { name: "배치 저장", exact: true }).click();
  await expect(dorm.getByText("책상 배치를 저장했습니다.")).toBeVisible();
  expect(world.mutations).toEqual([{ path: "/api/game/inventory/place", count: null, body: { item_id: "lamp", placed: true, x: 0, y: 100 } }]);
  await dorm.getByRole("button", { name: "패널 닫기", exact: true }).click();
  dorm = await openDorm(page);
  const item = dorm.getByRole("button", { name: "황동 스탠드 위치 편집" });
  await expect(item).toBeVisible();
  await item.click();
  await expect(dorm.getByRole("slider", { name: /세로 위치/ })).toHaveValue("100");
  await dorm.getByLabel("책상에 배치", { exact: true }).uncheck();
  await dorm.getByRole("button", { name: "배치 저장", exact: true }).click();
  await expect(dorm.getByText("책상에서 아이템을 치웠습니다.")).toBeVisible();
  expect(world.mutations[1].body).toEqual({ item_id: "lamp", placed: false, x: null, y: null });
  await expect(item).toHaveCount(0);
});

test("다연차 확인·중복 클릭 방지·잔액과 수량 갱신·주간 내 순위", async ({ page }) => {
  const world = await mockWorld(page);
  await login(page);
  const dorm = await openDorm(page);
  await dorm.getByRole("button", { name: "아이템 뽑기", exact: true }).click();
  await dorm.getByLabel("뽑기 횟수", { exact: true }).selectOption("2");
  await dorm.getByRole("button", { name: "뽑기 선택", exact: true }).click();
  expect(world.mutations).toHaveLength(0);
  await expect(dorm.getByText("2회 뽑기에 600 코인을 사용합니다.")).toBeVisible();
  await dorm.getByRole("button", { name: "취소", exact: true }).click();
  expect(world.mutations).toHaveLength(0);
  await dorm.getByRole("button", { name: "뽑기 선택", exact: true }).click();
  await dorm.getByRole("button", { name: "코인 사용하고 뽑기", exact: true }).dblclick();
  await expect(dorm.getByRole("region", { name: "뽑기 결과" }).getByText("600코인 사용 · 남은 코인 300")).toBeVisible();
  expect(world.mutations).toEqual([{ path: "/api/game/gacha", body: null, count: 2 }]);
  await expect(page.getByRole("button", { name: /게임 정보: JFK 입국자 · 300 코인/ })).toBeVisible();
  await expect(dorm.getByText("선택한 뽑기에 필요한 코인이 부족합니다.")).toBeVisible();
  await expect(dorm.getByRole("button", { name: "뽑기 선택", exact: true })).toBeDisabled();
  await dorm.getByRole("button", { name: "나의 책상", exact: true }).click();
  await expect(dorm.getByRole("button", { name: /황동 스탠드 · 3개/ })).toBeVisible();
  await dorm.getByRole("button", { name: "주간 랭킹", exact: true }).click();
  await expect(dorm.getByText("내 순위 2위", { exact: true })).toBeVisible();
  await expect(dorm.getByRole("listitem").filter({ hasText: "나의 학습 기록 (나)" })).toHaveAttribute("aria-current", "true");
  await dorm.getByRole("heading", { name: "주간 랭킹", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("ranking.png") });
});

test("잔액 부족 409와 응답 유실은 구분하며 유실된 뽑기를 재전송하지 않음", async ({ page }) => {
  await mockWorld(page);
  let calls = 0;
  await page.route("http://localhost:3101/api/game/gacha?**", (route) => {
    calls += 1;
    return calls === 1 ? route.fulfill({ status: 409, json: { detail: "코인이 부족합니다." } }) : route.abort();
  });
  await login(page);
  const dorm = await openDorm(page);
  await dorm.getByRole("button", { name: "아이템 뽑기", exact: true }).click();
  await dorm.getByRole("button", { name: "뽑기 선택", exact: true }).click();
  await dorm.getByRole("button", { name: "코인 사용하고 뽑기", exact: true }).click();
  await expect(dorm.getByText("코인이 부족합니다.", { exact: true })).toBeVisible();
  await dorm.getByRole("button", { name: "뽑기 선택", exact: true }).click();
  await dorm.getByRole("button", { name: "코인 사용하고 뽑기", exact: true }).click();
  await expect(dorm.getByText(/뽑기 처리 여부를 확인할 수 없습니다/)).toBeVisible();
  await dorm.getByRole("button", { name: "잔액·아이템 새로고침", exact: true }).click();
  await dorm.getByRole("button", { name: "나의 책상", exact: true }).click();
  await dorm.getByRole("button", { name: "아이템 뽑기", exact: true }).click();
  await expect(dorm.getByRole("button", { name: "결과 확인 필요", exact: true })).toBeDisabled();
  expect(calls).toBe(2);
});

test("빈 목록과 조회 실패 구분·로그아웃 시 개인 데이터 정리", async ({ page }) => {
  await mockWorld(page);
  let failed = false;
  await page.route("http://localhost:3101/api/game/inventory", (route) => failed ? route.fulfill({ status: 503, json: { detail: "모의 설정 없음" } }) : route.fulfill({ json: { items: [] } }));
  await page.route("http://localhost:3101/api/game/leaderboard?**", (route) => route.fulfill({ json: { rows: [], my_rank: null } }));
  await login(page);
  const dorm = await openDorm(page);
  await expect(dorm.getByText(/아직 보유한 아이템이 없습니다/)).toBeVisible();
  failed = true;
  await dorm.getByRole("button", { name: "보유 아이템 새로고침", exact: true }).click();
  await expect(dorm.getByText("게임 서버 설정을 확인해 주세요.")).toBeVisible();
  await expect(dorm.getByText(/아직 보유한 아이템이 없습니다/)).toHaveCount(0);
  await dorm.getByRole("button", { name: "주간 랭킹", exact: true }).click();
  await expect(dorm.getByText("아직 이번 주 랭킹 기록이 없습니다.")).toBeVisible();
  await dorm.getByRole("button", { name: "패널 닫기" }).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await openDorm(page);
  await expect(dorm.getByText("로그인하면 나만의 책상을 꾸밀 수 있습니다")).toBeVisible();
  await expect(dorm.getByRole("navigation", { name: "책상과 도전 메뉴" })).toHaveCount(0);
});

test("게스트에게 로그인 안내·작은 화면에서 기숙사 편집 접근", async ({ page }) => {
  const world = await mockWorld(page);
  await page.goto("/");
  let dorm = await openDorm(page);
  await expect(dorm.getByText("로그인하면 나만의 책상을 꾸밀 수 있습니다")).toBeVisible();
  expect(world.mutations).toHaveLength(0);
  await login(page);
  await page.setViewportSize({ width: 320, height: 568 });
  dorm = await openDorm(page);
  await dorm.getByRole("button", { name: /황동 스탠드 · 1개/ }).click();
  await dorm.getByRole("button", { name: "배치 저장", exact: true }).scrollIntoViewIfNeeded();
  await expect(dorm.getByRole("button", { name: "배치 저장", exact: true })).toBeInViewport();
  await page.screenshot({ path: test.info().outputPath("dorm-mobile.png") });
});

test("미보유 아이템 404는 배치 실패로 안내하고 랭킹 조회 실패를 빈 순위로 숨기지 않음", async ({ page }) => {
  await mockWorld(page);
  await page.route("http://localhost:3101/api/game/inventory/place", (route) => route.fulfill({ status: 404, json: { detail: "보유하지 않은 아이템입니다." } }));
  await page.route("http://localhost:3101/api/game/leaderboard?**", (route) => route.fulfill({ status: 503, json: { detail: "모의 조회 실패" } }));
  await login(page);
  const dorm = await openDorm(page);
  await dorm.getByRole("button", { name: /황동 스탠드 · 1개/ }).click();
  await dorm.getByRole("button", { name: "배치 저장", exact: true }).click();
  await expect(dorm.getByText(/보유하지 않은 아이템입니다/)).toBeVisible();
  await dorm.getByRole("button", { name: "주간 랭킹", exact: true }).click();
  await expect(dorm.getByText("게임 서버 설정을 확인해 주세요.")).toBeVisible();
  await expect(dorm.getByText("아직 이번 주 랭킹 기록이 없습니다.")).toHaveCount(0);
});
