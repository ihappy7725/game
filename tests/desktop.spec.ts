import { test, expect, type Page } from "./fixtures";

test.beforeEach(async ({ context }) => {
  // 잘못 연결되더라도 실제 채점·Supabase·외부 서비스에 요청을 보내지 않습니다.
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && ["3000", "3101"].includes(url.port)
      ? route.continue() : route.abort();
  });
});

const windowFor = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
async function loginForGrading(page: Page) {
  await page.goto("/login");
  await page.getByLabel("이메일", { exact: true }).fill("learner@example.test");
  await page.getByLabel("비밀번호").fill("local-test-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page).toHaveURL(/\/history$/);
  await page.goto("/");
}
async function openApp(page: Page, name: string) {
  const home = page.getByRole("button", {name:"홈으로",exact:true});
  if(await home.isVisible()) await home.click();
  if(name==="History") { await page.getByRole("button",{name:"학습 기록",exact:true}).click(); return; }
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();
  await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:name==="Writing AI" ? /라이팅/ : /스피킹/}).click();
}

test("학습 화면 전환·입력과 모의 채점 결과 유지·닫기", async ({ page }) => {
  await loginForGrading(page);
  await expect(page.getByText("API 연결됨")).toHaveCount(0);
  await openApp(page,"Writing AI");
  const writing=windowFor(page,"라이팅");
  const essay="Students should study together because they can share useful examples and improve their ideas. This is a local practice essay.";
  await writing.getByLabel("에세이 본문").fill(essay);
  await writing.getByRole("button",{name:"채점 받기"}).click();
  await expect(writing.getByText("모의 채점 결과입니다.")).toBeVisible();
  await openApp(page,"Speaking AI");
  const speaking=windowFor(page,"스피킹");
  await speaking.getByLabel("문제 지문").fill("스피킹 입력 유지 검사");
  const ids=await page.locator("input[id],textarea[id],select[id]").evaluateAll(elements=>elements.map(e=>e.id));
  expect(new Set(ids).size).toBe(ids.length);
  await openApp(page,"Writing AI");
  await expect(writing.getByLabel("에세이 본문")).toHaveValue(essay);
  await expect(writing.getByText("모의 채점 결과입니다.")).toBeVisible();
  await page.screenshot({path:test.info().outputPath("writing.png")});
  await writing.getByRole("button",{name:"닫기",exact:true}).click();
  await expect(writing).toHaveCount(0);
  await openApp(page,"Speaking AI");
  await expect(speaking.getByLabel("문제 지문")).toHaveValue("스피킹 입력 유지 검사");
});

test("가상 마이크 녹음·재생·모의 채점 유지와 닫기 정리", async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    const streams: MediaStream[] = [];
    Object.assign(window, { testStreams: streams });
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      streams.push(stream);
      return stream;
    };
  });
  await loginForGrading(page);
  await openApp(page, "Speaking AI");
  const speaking = windowFor(page, "스피킹");
  await speaking.getByRole("button", { name: "녹음 시작", exact: true }).click();
  await expect(speaking.getByRole("button", { name: "녹음 정지" })).toBeVisible();
  await expect.poll(() => speaking.locator(".font-mono").allTextContents()).not.toEqual([]);
  await page.waitForTimeout(1200);
  await speaking.getByRole("button", { name: "녹음 정지" }).click();
  const audio = speaking.locator("audio");
  await expect(audio).toBeVisible();
  const source = await audio.getAttribute("src");
  await audio.evaluate((el) => (el as HTMLAudioElement).play());
  await expect.poll(() => audio.evaluate((el) => (el as HTMLAudioElement).currentTime)).toBeGreaterThan(0);
  await speaking.getByRole("button", { name: "채점 받기", exact: true }).click();
  await expect(speaking.getByText("모의 채점 결과입니다.")).toBeVisible();
  await speaking.getByRole("button", { name: "홈으로", exact: true }).click();
  await openApp(page, "Speaking AI");
  await expect(audio).toHaveAttribute("src", source!);
  await expect(speaking.getByText("모의 채점 결과입니다.")).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("speaking.png") });
  await speaking.getByRole("button", { name: "다시 녹음", exact: true }).click();
  await expect(speaking.getByRole("button", { name: "녹음 정지" })).toBeVisible();
  await speaking.getByRole("button", { name: "닫기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => {
    const streams = (window as unknown as { testStreams: MediaStream[] }).testStreams;
    return streams.every((stream) => stream.getTracks().every((track) => track.readyState === "ended"));
  })).toBe(true);
});

test("테마 저장·비로그인 안내·모의 로그인과 로그아웃 즉시 전환", async ({ page, context }) => {
  await page.goto("/");
  await openApp(page, "History");
  const history = windowFor(page, "학습 기록");
  await expect(history.getByText("로그인하면 학습 기록이 보입니다")).toBeVisible();
  await history.getByRole("button",{name:"홈으로",exact:true}).click();
  await page.getByRole("button", { name: "공부 모드",exact:true }).click();
  await page.reload();
  await expect(page.locator("[data-os-mode]")).toHaveAttribute("data-os-mode", "study");
  await openApp(page, "History");
  const login = await context.newPage();
  await login.goto("/login");
  await login.getByLabel("이메일", { exact: true }).fill("learner@example.test");
  await login.getByLabel("비밀번호", { exact: false }).fill("local-test-password");
  await login.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(history.getByText("아직 쌓인 기록이 없습니다")).toBeVisible();
  await history.getByRole("button",{name:"홈으로",exact:true}).click();
  await page.getByRole("button", { name: "로그아웃", exact: true }).click();
  await openApp(page,"History");
  await expect(history.getByText("로그인하면 학습 기록이 보입니다")).toBeVisible();
  await expect(history.getByText("아직 쌓인 기록이 없습니다")).toHaveCount(0);
});

test("작은 화면에서 모드·아이콘 스크롤·우측 도구 접근", async ({ page }) => {
  await page.setViewportSize({width:320,height:568});
  await page.goto("/");
  const games=page.getByRole("navigation",{name:"미니게임"});
  await games.getByRole("button",{name:/메모리 카드/}).scrollIntoViewIfNeeded();
  await games.getByRole("button",{name:/메모리 카드/}).click();
  await expect(page.getByRole("region",{name:"전체 화면 게임"})).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();
  await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리딩/}).click();
  await expect(page.getByRole("heading",{name:"Reading 연습실"})).toBeVisible();
  await page.getByRole("button",{name:"홈으로",exact:true}).click();
  await page.getByRole("complementary",{name:"나의 도구"}).getByRole("button",{name:"동기부여",exact:true}).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({path:test.info().outputPath("mobile.png")});
  await page.keyboard.press("Escape");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("개별 경로 보존과 임시 경로 제거", async ({ page }) => {
  const historyHtml = await (await page.request.get("/history")).text();
  expect(historyHtml).toContain("세션을 확인하는 중...");
  for (const path of ["/writing", "/speaking", "/history", "/login"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("link", { name: "홈으로" })).toBeVisible();
  }
  expect((await page.goto("/os-preview"))?.status()).toBe(404);
});

test("마이크 권한 대기 중 닫은 창도 뒤늦은 스트림을 정리", async ({ page }) => {
  await page.addInitScript(() => {
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await original(constraints);
      return new Promise<MediaStream>((resolve) => {
        Object.assign(window, { pendingMic: { stream, resolve: () => resolve(stream) } });
      });
    };
  });
  await page.goto("/");
  await openApp(page, "Speaking AI");
  const speaking = windowFor(page, "스피킹");
  await speaking.getByRole("button", { name: "녹음 시작", exact: true }).click();
  await expect(speaking.getByText("마이크 권한 요청 중...")).toBeVisible();
  await expect.poll(() => page.evaluate(() => "pendingMic" in window)).toBe(true);
  await speaking.getByRole("button", { name: "닫기", exact: true }).click();
  await page.evaluate(() => (window as unknown as { pendingMic: { resolve: () => void } }).pendingMic.resolve());
  await expect.poll(() => page.evaluate(() => (window as unknown as { pendingMic: { stream: MediaStream } }).pendingMic.stream.getTracks().every((track) => track.readyState === "ended"))).toBe(true);
});

test("백엔드가 꺼져 있어도 홈 아이콘 사용·삭제한 API 표시 없음", async ({ page }) => {
  await page.route("http://localhost:3101/", (route) => route.abort());
  await page.goto("/");
  await expect(page.getByText(/API 응답 없음|API 연결됨|서버 확인 중/)).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "미니게임" }).getByRole("button")).toHaveCount(4);
});
