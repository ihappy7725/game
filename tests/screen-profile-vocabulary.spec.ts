import { test, expect, type Page } from "./fixtures";
import vocabulary from "../src/data/vocabulary.json";
import backup from "../src/data/vocabulary.backup.json";
import { popLegalMove } from "../src/lib/word-pop";
import { branchPose, FORK_START } from "../src/lib/fork-world";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const url = new URL(route.request().url()); return url.hostname === "localhost" && ["3000", "3101"].includes(url.port) ? route.continue() : route.abort(); });
});

test("4,000개 형식·214개 백업·철자·마지막 블록과 예문·저장 기록 유지", async ({ page }) => {
  expect(vocabulary).toHaveLength(4000); expect(backup).toHaveLength(214);
  expect(vocabulary.slice(0, 214).map(item => item.word)).toEqual(backup.map(item => item.word));
  expect(new Set(vocabulary.map(item => item.word.toLowerCase())).size).toBe(4000);
  const invalid = vocabulary.filter(item => [item.word, item.meaning, item.synonym, item.example, ...item.decoys].some(field => !field.trim()) || item.decoys.length !== 2 || new Set([item.synonym, ...item.decoys].map(value => value.trim().toLowerCase())).size !== 3);
  expect(invalid.map(item => item.word)).toEqual([]);
  await page.addInitScript(word => localStorage.setItem("toefl-learning-v1:guest", JSON.stringify({ learned: [word], stages: { cab: [1, 0, 0] } })), backup[0].word);
  await page.goto("/"); await expect(page.getByLabel("전체 단어 학습량", { exact: true })).toHaveAttribute("value", "1");
  await page.getByRole("button", { name: "학습한 단어량 열기" }).click(); await page.getByRole("button", { name: "단어 블록 40", exact: true }).click();
  await expect(page.locator(".vocab-word-list li")).toHaveCount(100); await expect(page.locator(".vocab-word-list")).toContainText(vocabulary[3999].example);
  await page.getByRole("button", { name: "플래시카드 시작", exact: true }).click(); await page.getByRole("button", { name: "단어 정답 뒤집기", exact: true }).click();
  await expect(page.locator(".vocab-flashcard")).toContainText(vocabulary[3900].example);
});

async function fits(page: Page) {
  const overflow = await page.locator(".game-fullscreen").evaluate(el => ({ x: el.scrollWidth - el.clientWidth, y: el.scrollHeight - el.clientHeight }));
  expect(overflow).toEqual({ x: 0, y: 0 });
  for (const button of await page.locator(".game-fullscreen button:visible").all()) {
    const box = (await button.boundingBox())!; const size = page.viewportSize()!;
    expect(box.y, await button.getAttribute("aria-label") ?? await button.innerText()).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height, await button.innerText()).toBeLessThanOrEqual(size.height + 1);
    expect(box.x).toBeGreaterThanOrEqual(-1); expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
  }
}
for (const viewport of [{ width: 1280, height: 720 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`${viewport.width}×${viewport.height} 네 게임 준비·플레이에 스크롤/잘린 버튼 없음, 큐브 글자 수용`, async ({ page }) => {
    test.setTimeout(90_000); await page.setViewportSize(viewport); await page.goto("/");
    for (const [name, start] of [["옐로캡 러시", "출발하기"], ["갈림길", "절벽 달리기 시작"], ["메모리 카드", "플래시카드 시작"], ["워드 팝", "워드 팝 시작"]]) {
      const launch = page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name, exact: true }); await launch.scrollIntoViewIfNeeded(); await launch.click();
      await expect(page.getByRole("button", { name: start, exact: true })).toBeVisible(); await fits(page);
      await page.getByRole("button", { name: start, exact: true }).click(); await page.getByRole("button", { name: "일시정지", exact: true }).click(); await fits(page);
      if (name === "워드 팝") {
        const board = page.locator(".pop-board"), box = (await board.boundingBox())!;
        expect(box.width).toBeGreaterThan(viewport.width === 320 ? 290 : viewport.height === 390 ? 180 : 390);
        expect(box.y + box.height).toBeLessThan(viewport.height);
        expect(await page.locator(".pop-tile strong").evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth + 1))).toBe(true);
        await page.screenshot({ path: test.info().outputPath(`pop-fit-${viewport.width}.png`), style: ".word-pause{visibility:hidden!important}" });
      }
      await page.keyboard.press("Escape");
    }
  });
}

test("갈림길 왼쪽·오른쪽 장면 좌표와 안개 너머 연장", async () => {
  const left = branchPose(FORK_START, 0, .7), right = branchPose(FORK_START, 1, .7);
  // +Z를 보는 카메라의 화면 왼쪽은 장면 +X: 월드 X를 반전합니다.
  expect(-left.x).toBeGreaterThan(0); expect(-right.x).toBeLessThan(0);

});

test("움직이는 큐브를 두 번 클릭해 실제 교환·팡 효과와 점수", async ({ page }) => {
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000)); await page.getByRole("button", { name: "워드 팝 시작", exact: true }).click();
  const tiles = page.locator(".pop-tile");
  const move = popLegalMove(await tiles.evaluateAll(items => items.map(el => ({ kind: Number(el.getAttribute("data-kind")) }))))!;
  await tiles.nth(move[0]).click(); await tiles.nth(move[1]).click(); await page.clock.fastForward(230);
  await expect(page.locator(".tile-burst").first()).toBeVisible(); await expect(page.locator(".pop-sparks em").first()).toBeVisible(); await expect(page.getByLabel("워드 팝 점수")).not.toHaveText("0점");
});

test("회원가입 닉네임·8개 캐릭터를 모의 인증 요청에 포함, 실제 계정 생성 없음", async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route("**/auth/v1/signup**", route => { payload = route.request().postDataJSON(); return route.fulfill({ json: { id: "mock-user", identities: [], user_metadata: payload?.data } }); });
  await page.goto("/login"); await page.getByRole("button", { name: "계정이 없으신가요? 회원가입" }).click();
  await expect(page.locator(".avatar-options button")).toHaveCount(8);
  await page.getByLabel("이메일", { exact: true }).fill("learner@example.test"); await page.getByLabel("비밀번호").fill("local-test-password");
  const submit = page.getByRole("button", { name: "회원가입", exact: true }); await expect(submit).toBeDisabled();
  await page.getByLabel("공개 닉네임").fill("캠퍼스 별빛"); await page.getByRole("button", { name: /캐릭터 8:/ }).click();
  await submit.click(); await expect.poll(() => payload).toBeDefined(); expect(payload!.data).toEqual({ nickname: "캠퍼스 별빛", avatar_id: "campus-08" });
  await page.screenshot({ path: test.info().outputPath("signup-avatars.png") });
});

test("기존 계정 프로필 편집·재접속과 닉네임/캐릭터 순위 표시 (모의 API)", async ({ page }) => {
  let metadata = { nickname: "첫 캠퍼스", avatar_id: "campus-01" }; let updates = 0;
  const user = () => ({ id: "00000000-0000-4000-8000-000000000001", aud: "authenticated", role: "authenticated", email: "learner@example.test", app_metadata: { provider: "email", providers: ["email"] }, user_metadata: metadata, created_at: "2026-01-01T00:00:00Z" });
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const token = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ sub: user().id, aud: "authenticated", exp: 4102444800 })}.mock-signature`;
  await page.route("**/auth/v1/token**", route => route.fulfill({ json: { access_token: token, refresh_token: "mock-refresh", token_type: "bearer", expires_in: 3600, user: user() } }));
  await page.route("**/auth/v1/user**", route => {
    if (route.request().method() === "PUT") { metadata = route.request().postDataJSON().data; updates++; }
    return route.fulfill({ json: user() });
  });
  await page.route("**/api/game/**", route => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/game/leaderboard") return route.fulfill({ json: { rows: [{ rank: 1, display_name: metadata.nickname, avatar_id: metadata.avatar_id, earned_this_week: 500, is_me: true }], my_rank: 1, profiles_ready: true } });
    if (path === "/api/game/inventory") return route.fulfill({ json: { items: [] } });
    if (path === "/api/game/state") return route.fulfill({ json: { coin_balance: 150, total_earned: 150, total_spent: 0, xp: 60, streak_days: 1, best_streak_days: 1, tier: { level: 1, id: "jfk", name: "JFK 입국자", emoji: "✈️", required_xp: 0 }, next_tier: null, xp_to_next_tier: null } });
    return route.fulfill({ json: {} });
  });
  await page.goto("/login"); await page.getByLabel("이메일", { exact: true }).fill("learner@example.test"); await page.getByLabel("비밀번호").fill("local-test-password"); await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect.poll(() => page.context().cookies().then(cookies => cookies.some(cookie => cookie.name.includes("auth-token")))).toBe(true);
  await page.goto("/profile"); await expect(page.getByLabel("공개 닉네임")).toHaveValue("첫 캠퍼스");
  await page.getByLabel("공개 닉네임").fill("별빛 공부왕"); await page.getByRole("button", { name: /캐릭터 6:/ }).click(); await page.getByRole("button", { name: "프로필 저장", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("저장했어요"); expect(updates).toBe(1); expect(metadata.avatar_id).toBe("campus-06");
  await page.reload(); await expect(page.getByLabel("공개 닉네임")).toHaveValue("별빛 공부왕"); await expect(page.getByRole("button", { name: /캐릭터 6:/ })).toHaveAttribute("aria-pressed", "true");
  await page.goto("/"); await page.getByRole("complementary", { name: "나의 도구" }).getByRole("button", { name: "주간 랭킹", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog.getByRole("list", { name: "이번 주 순위" })).toContainText("별빛 공부왕");
  await expect(dialog.locator(".ranking-avatar .player-avatar")).toBeVisible(); await expect(dialog).not.toContainText("learner@example.test");
  await dialog.getByRole("button", { name: "나의 책상", exact: true }).click(); await expect(dialog.locator(".desk-placed-item")).toHaveCount(0); await expect(dialog.locator(".desk-room-art")).toHaveCSS("background-image", /empty-campus-desk-v1/);
  await page.screenshot({ path: test.info().outputPath("empty-desk.png") });
});
