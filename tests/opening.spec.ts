import { test, expect } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const url = new URL(route.request().url()); return url.hostname === "localhost" && ["3000", "3101"].includes(url.port) ? route.continue() : route.abort(); });
});

test("첫 접속 실제 오프닝 재생 → 검은 화면 → 홈 페이드인 · 재방문 보존", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play, attempts: boolean[] = [];
    (window as unknown as { openingPlayAttempts: boolean[] }).openingPlayAttempts = attempts;
    HTMLMediaElement.prototype.play = function () { if (this.hasAttribute("data-opening-video")) attempts.push(this.muted); return play.call(this); };
  });
  await page.goto("/"); const opening = page.getByRole("dialog", { name: "토플 유니온 오프닝" }); const video = opening.locator("video");
  await expect(opening).toBeVisible(); const box = (await opening.boundingBox())!; expect(box.width).toBe(1280); expect(box.height).toBe(900);
  expect(await page.locator(".hub-shell").evaluate(el => (el as HTMLElement).inert)).toBe(true);
  await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  expect(await page.evaluate(() => (window as unknown as { openingPlayAttempts: boolean[] }).openingPlayAttempts[0])).toBe(false);
  expect(await video.evaluate(el => (el as HTMLVideoElement).videoWidth)).toBe(1280);
  // 실제 Chrome의 자동재생 허용 여부와 관계없이 초기 유음 시도와 사용자 제어를 검사합니다.
  if (await video.evaluate(el => (el as HTMLVideoElement).muted)) {
    await expect(opening).toContainText("브라우저가 소리 자동재생을 제한했어요");
    await opening.getByRole("button", { name: "오프닝 소리 켜기" }).click();
  }
  await opening.getByRole("button", { name: "오프닝 소리 끄기" }).click();
  expect(await video.evaluate(el => (el as HTMLVideoElement).muted)).toBe(true);
  await opening.getByRole("button", { name: "오프닝 소리 켜기" }).click();
  await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true);
  expect(await video.evaluate(el => (el as HTMLVideoElement).muted)).toBe(false);
  await page.screenshot({ path: test.info().outputPath("opening.png") });
  // 200ms 검은 화면은 자동 재시도 간격 사이에 지나갈 수 있어 DOM 전환을 직접 기록합니다.
  await opening.evaluate(el => {
    const captured = { phases: [] as string[], blackOpacity: 1 };
    (window as unknown as { openingFrames: typeof captured }).openingFrames = captured;
    const observer = new MutationObserver(() => {
      captured.phases.push(el.getAttribute("data-phase")!);
      if (el.getAttribute("data-phase") === "black") captured.blackOpacity = Number(getComputedStyle(el.querySelector("video")!).opacity);
    });
    observer.observe(el, { attributes: true, attributeFilter: ["data-phase"] });
  });
  await video.evaluate(el => { const movie = el as HTMLVideoElement; movie.currentTime = movie.duration - .15; });
  await expect(opening).toHaveCount(0);
  const frames = await page.evaluate(() => (window as unknown as { openingFrames: { phases: string[]; blackOpacity: number } }).openingFrames);
  expect(frames.phases).toEqual(["out", "black", "in"]); expect(frames.blackOpacity).toBeLessThan(.03);
  await expect(page.getByRole("navigation", { name: "미니게임" })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem("toefl-opening-seen-v1"))).toBe("1");
  await page.keyboard.press("Escape"); await expect.poll(() => page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.getByRole("button", { name: "공부 모드", exact: true }).click(); expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false);
  await page.reload(); await expect(opening).toHaveCount(0); expect(errors).toEqual([]);
});

test("작은 화면 오프닝·키보드 건너뛰기·음소거 설정 보존", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => localStorage.setItem("toefl-sound-muted", "true"));
  await page.goto("/"); const opening = page.getByRole("dialog", { name: "토플 유니온 오프닝" });
  await expect(opening).toBeFocused(); await expect(opening.getByRole("button", { name: "오프닝 건너뛰기" })).toBeInViewport();
  await page.keyboard.press("Escape"); await expect(opening).toHaveCount(0);
  await expect(page.getByRole("button", { name: "소리 켜기", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("오프닝 영상 실패해도 안내와 홈 이동 가능", async ({ page }) => {
  await page.route("**/backgrounds/intro.mp4", route => route.fulfill({ status: 404, body: "" }));
  await page.goto("/"); const opening = page.getByRole("dialog", { name: "토플 유니온 오프닝" });
  await expect(opening).toContainText("오프닝을 재생할 수 없어요");
  await opening.getByRole("button", { name: "오프닝 건너뛰기" }).click(); await expect(opening).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "미니게임" })).toBeVisible();
});

test("소리 자동재생을 거부하는 브라우저에서 무음으로 이어지고 버튼으로 복구", async ({ page }) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      if (this.hasAttribute("data-opening-video") && !this.muted && !navigator.userActivation.isActive) return Promise.reject(new DOMException("사용자 동작 필요", "NotAllowedError"));
      return play.call(this);
    };
  });
  await page.goto("/"); const opening = page.getByRole("dialog", { name: "토플 유니온 오프닝" }), video = opening.locator("video");
  await expect(opening).toContainText("브라우저가 소리 자동재생을 제한했어요"); await expect.poll(() => video.evaluate(el => (el as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  expect(await video.evaluate(el => (el as HTMLVideoElement).muted)).toBe(true);
  await opening.getByRole("button", { name: "오프닝 소리 켜기" }).click(); expect(await video.evaluate(el => (el as HTMLVideoElement).muted)).toBe(false);
  await opening.getByRole("button", { name: "오프닝 건너뛰기" }).click(); await expect(opening).toHaveCount(0);
});
