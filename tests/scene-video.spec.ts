import { expect, test } from "./fixtures";
import { readFileSync } from "node:fs";

test("합성 테스트 영상의 실제 무음 반복 재생·수동 정지·모드/동작 줄이기", async ({ page, context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
  // 고정 VP9 테스트 패턴이며 실제 배경 영상으로 사용하지 않습니다.
  const video = readFileSync("tests/fixtures/scene-loop.webm");
  await page.route("**/backgrounds/scene-videos.json", route => route.fulfill({ json: { arcade: "/backgrounds/test-loop.webm", study: "/backgrounds/test-loop.webm" } }));
  await page.route("**/backgrounds/test-loop.webm", route => route.fulfill({ contentType: "video/webm", body: video }));
  await page.goto("/"); const element = page.locator("video.scene-video");
  await expect(page.locator(".learning-hub>.landmark-scene")).toHaveAttribute("data-scene-kind", "video");
  await expect.poll(() => page.evaluate(() => document.querySelector<HTMLVideoElement>("video.scene-video")?.currentTime ?? -1)).toBeGreaterThan(.05);
  expect(await element.evaluate(el => (el as HTMLVideoElement).muted && (el as HTMLVideoElement).loop && (el as HTMLVideoElement).playsInline)).toBe(true);
  await page.getByRole("button", { name: "동기부여", exact: true }).click(); await expect.poll(() => element.evaluate(el => (el as HTMLVideoElement).paused)).toBe(true);
  const time = await element.evaluate(el => (el as HTMLVideoElement).currentTime); await page.waitForTimeout(200); expect(await element.evaluate(el => (el as HTMLVideoElement).currentTime)).toBe(time);
  await page.getByRole("button", { name: "패널 닫기", exact: true }).click(); await page.getByRole("button", { name: "공부 모드", exact: true }).click(); await expect(element).toHaveCount(1);
  await expect.poll(() => element.evaluate(el => (el as HTMLVideoElement).paused)).toBe(false); await page.emulateMedia({ reducedMotion: "reduce" }); await expect.poll(() => element.evaluate(el => (el as HTMLVideoElement).paused)).toBe(true);
});
