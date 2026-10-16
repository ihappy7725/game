import { expect, test } from "@playwright/test";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && ["3000", "3101"].includes(url.port) ? route.continue() : route.abort();
  });
});

const games = [
  { name: "옐로캡 러시", start: "출발하기", scene: ".cab-city", asset: "cab-world", sprite: ".cab-car-sprite" },
  { name: "갈림길", start: "절벽 달리기 시작", scene: ".cliff-landscape", asset: "cliff-world", sprite: ".runner-back" },
  { name: "서브웨이 점프", start: "서브웨이 출발", scene: ".subway-city", asset: "subway-world", sprite: ".runner-side" },
  { name: "메모리 카드", start: "플래시카드 시작", scene: ".memory-library", asset: "memory-world", sprite: ".memory-flashcard" },
];

test("네 게임의 실제 원화·캐릭터 표시와 데스크톱 캡처", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await page.goto("/"); await page.clock.install(); await page.clock.pauseAt(new Date());
  for (const game of games) {
    await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: game.name, exact: true }).click();
    await page.getByRole("button", { name: game.start, exact: true }).click();
    const scene = page.locator(game.scene);
    const image = await scene.evaluate(async el => {
      const url = getComputedStyle(el).backgroundImage.slice(5, -2);
      const image = new Image(); image.src = url; await image.decode(); return { width: image.naturalWidth, url };
    });
    expect(image.width).toBeGreaterThan(1600); expect(image.url).toContain(game.asset);
    await expect(page.locator(game.sprite)).toBeVisible();
    if (game.name === "옐로캡 러시") {
      const road = (await page.locator(".cab-race-world").boundingBox())!;
      const car = (await page.locator(".cab-player").boundingBox())!;
      expect(car.x + car.width / 2).toBeCloseTo(road.x + road.width / 2, 0);
    }
    if (game.name !== "메모리 카드") {
      const width = await page.locator(game.sprite).evaluate(async el => { const image = new Image(); image.src = getComputedStyle(el).backgroundImage.slice(5, -2); await image.decode(); return image.naturalWidth; });
      expect(width).toBeGreaterThan(300);
    }
    await page.screenshot({ animations: "disabled", path: test.info().outputPath(`${game.asset}-desktop.png`) });
    if (game.name === "메모리 카드") {
      const card = page.getByRole("button", { name: "정답 뒤집기", exact: true }); await card.focus(); await page.keyboard.press("Space");
      await expect(page.getByRole("button", { name: "카드 앞면 보기", exact: true })).toBeFocused();
    }
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("320px·동작 줄이기에서 네 게임의 새 아트와 조작 접근", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/"); await page.clock.install(); await page.clock.pauseAt(new Date());
  for (const game of games) {
    const launcher = page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: game.name, exact: true }); await launcher.scrollIntoViewIfNeeded(); await launcher.click();
    await page.getByRole("button", { name: game.start, exact: true }).click(); await expect(page.locator(game.sprite)).toBeVisible();
    const controls = game.name === "옐로캡 러시" ? ".cab-road-lane" : game.name === "갈림길" ? ".word-touch button" : game.name === "서브웨이 점프" ? ".word-platform" : ".memory-flashcard";
    for (const button of await page.locator(controls).all()) await expect(button).toBeInViewport();
    if (game.name !== "메모리 카드") await expect(page.locator(game.sprite)).toHaveCSS("animation-name", "none");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: test.info().outputPath(`${game.asset}-mobile.png`) });
    await page.keyboard.press("Escape");
  }
});
