import { test, expect } from "./fixtures";
import { FORK_START, approachPose, branchPose, nextFork } from "../src/lib/fork-world";
import { VOCAB } from "../src/lib/vocab";
import { forkDuration } from "../src/lib/word-arcade";

test("분기 끝과 다음 길 시작은 같은 좌표 · 여러 번 방향을 바꿔도 연속", () => {
  let origin = FORK_START;
  for (const choice of [0, 1, 1, 0, 0, 1, 0]) {
    expect(branchPose(origin, choice, 0)).toEqual(approachPose(origin, 1));
    const end = branchPose(origin, choice, 1), next = nextFork(origin, choice);
    expect(approachPose(next, 0)).toEqual(end);
    expect(Math.abs(next.heading - origin.heading)).toBeCloseTo(.56);
    expect(Number.isFinite(next.x + next.z)).toBe(true); origin = next;
  }
  expect(nextFork(FORK_START, 0).x).toBeLessThan(0); expect(nextFork(FORK_START, 1).x).toBeGreaterThan(0);
});

test("실제 선택 방향으로 월드·카메라 이동 · 연속 정답 · 점프 삭제", async ({ page, context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click();
  await page.clock.install({ time: new Date(0) }); await page.clock.pauseAt(new Date(1000));
  await page.getByRole("button", { name: "절벽 달리기 시작" }).click();
  const world = page.locator(".fork-live-world"), canvas = world.locator("canvas");
  await expect(page.locator(".game-backdrop video")).toHaveCount(0); await expect(page.getByRole("button", { name: /SPACE|점프/ })).toHaveCount(0);
  await expect(world).toHaveAttribute("data-renderer","webgl");
  expect(Number(await canvas.getAttribute("data-triangles"))).toBeGreaterThan(1000);
  let origin = FORK_START;
  for (let n = 0; n < 4; n++) {
    const meaning = await page.getByLabel("갈림길 한국어 뜻").textContent(), item = VOCAB.find(word => word.meaning === meaning)!;
    const sign = page.locator(".fork-sign").filter({ hasText: item.word }); const choice = (await sign.getAttribute("class"))!.includes("fork-0") ? 0 : 1;
    await sign.click(); await page.clock.fastForward(forkDuration(0, n) + 30); const before = await canvas.getAttribute("data-camera");
    await page.clock.runFor(400); expect(await canvas.getAttribute("data-camera")).not.toBe(before);
    await page.clock.runFor(420); origin = nextFork(origin, choice);
    await expect(world).toHaveAttribute("data-origin-x", origin.x.toFixed(2)); await expect(world).toHaveAttribute("data-origin-z", origin.z.toFixed(2)); await expect(world).toHaveAttribute("data-heading", origin.heading.toFixed(2));
  }
  await page.screenshot({ path: test.info().outputPath("fork-continuous-world.png") });
  await page.keyboard.press("Space"); await expect(page.locator(".runner-jumping")).toHaveCount(0);
  await page.keyboard.press("Escape"); await expect(world).toHaveCount(0);
});

test("워드 팝 문제 상자·HUD·점수·보드는 데스크톱과 모바일에서 겹치지 않음", async ({ page, context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
  for (const size of [{ width: 1280, height: 900 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(size); await page.goto("/");
    await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "워드 팝", exact: true }).click(); await page.getByRole("button", { name: "워드 팝 시작" }).click();
    const boxes = [];
    for (const selector of [".pop-stats", ".pop-mission", ".pop-score-goal", ".pop-board"]) boxes.push((await page.locator(selector).boundingBox())!);
    for (let i = 0; i < boxes.length - 1; i++) expect(boxes[i].y + boxes[i].height).toBeLessThanOrEqual(boxes[i + 1].y);
    expect(boxes[1].x + boxes[1].width / 2).toBeCloseTo(size.width / 2, 0);
    const panel = page.getByLabel("한국어 미션"); await expect(panel).toContainText("이 뜻의 단어"); await expect(panel).toContainText("미션 0개 성공");
    for (const tile of await page.locator(".pop-tile").all()) await expect(tile).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`pop-panel-${size.width}.png`) });
  }
});
