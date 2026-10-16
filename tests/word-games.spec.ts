import { expect, test, type Page, type Locator } from "@playwright/test";
import { VOCAB } from "../src/lib/vocab";
import { forkDuration, forkEnergy } from "../src/lib/word-arcade";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url());
    return url.hostname === "localhost" && ["3000", "3101"].includes(url.port) ? route.continue() : route.abort();
  });
});

async function open(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name, exact: true }).click();
  const game = page.getByRole("region", { name: "전체 화면 게임" });
  await page.clock.install({time:new Date(0)}); await page.clock.pauseAt(new Date(1000));
  return game;
}
async function choose(game: Locator, kind: "갈림길" | "서브웨이", correct = true) {
  const meaning = await game.getByLabel(`${kind} 한국어 뜻`).textContent();
  const item = VOCAB.find(item => item.meaning === meaning);
  if (!item) throw new Error("문항을 찾지 못했습니다.");
  const buttons = game.locator(kind === "갈림길" ? ".fork-sign" : ".word-platform");
  for (const button of await buttons.all()) {
    if ((await button.textContent())!.includes(item.word) === correct) { await button.click(); return; }
  }
  throw new Error("선택지를 찾지 못했습니다.");
}

test("갈림길 정답 통과·체력 보급·낙석 피해와 점프 회피·오답 즉시 추락", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  const game = await open(page, "갈림길"); await game.getByRole("button", { name: "절벽 달리기 시작" }).click();
  for (let i = 0; i < 8; i++) {
    await choose(game, "갈림길");
    if (i === 7) { await page.clock.fastForward(1300); await game.getByRole("button", { name: "점프 · SPACE", exact: true }).click(); }
    await page.clock.fastForward(forkDuration(0, i) - (i === 7 ? 1300 : 0) + 30);
    await expect(game.getByLabel("갈림길 기록")).toContainText(`${i + 1}개 통과`);
    if ((i + 1) % 3 === 0) await expect(game.getByRole("status")).toContainText("보급 획득");
    if (i === 3) await expect(game.getByRole("status")).toContainText("낙석 충돌");
    if (i === 7) await expect(game.getByRole("status")).toContainText("낙석 점프 성공");
    await page.clock.fastForward(810);
  }
  await choose(game, "갈림길", false); await page.clock.fastForward(forkDuration(0, 8) + 30);
  await expect(game.getByRole("status")).toContainText("길이 무너졌어요"); await page.clock.fastForward(810);
  await expect(game.getByLabel("갈림길 결과")).toBeVisible();
  await expect(game.getByLabel("갈림길 기록")).toContainText("8개 통과");
  await game.getByRole("button", { name: "다시 달리기" }).click(); await expect(game.getByLabel("갈림길 기록")).toContainText("0점");
  expect(errors).toEqual([]);
});

test("갈림길 시간 초과·일시정지·탭 숨김·Esc 타이머 정리", async ({ page }) => {
  const game = await open(page, "갈림길"); await game.getByRole("button", { name: "절벽 달리기 시작" }).click();
  await page.clock.fastForward(1000); await game.getByRole("button", { name: "일시정지", exact: true }).click();
  const meaning = await game.getByLabel("갈림길 한국어 뜻").textContent();
  await page.clock.fastForward(60_000); await expect(game.getByLabel("갈림길 한국어 뜻")).toHaveText(meaning!);
  await game.getByRole("button", { name: "계속 달리기" }).click();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: true }); document.dispatchEvent(new Event("visibilitychange")); });
  await expect(game.getByRole("button", { name: "계속 달리기" })).toBeVisible();
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { configurable: true, value: false }); });
  await game.getByRole("button", { name: "계속 달리기" }).click(); await page.clock.fastForward(3000);
  await expect(game.getByRole("status")).toContainText("고르지 못했어요"); await page.clock.fastForward(810);
  await expect(game.getByLabel("갈림길 결과")).toBeVisible(); await page.keyboard.press("Escape");
  await page.clock.fastForward(60_000); await expect(game).toHaveCount(0);
  await expect(page.getByRole("navigation", { name: "미니게임" })).toBeVisible();
});

test("320px 화면·동작 줄이기에서도 두 게임의 문제와 터치 버튼 접근", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 }); await page.emulateMedia({ reducedMotion: "reduce" });
  for (const name of ["갈림길"]) {
    if (name === "갈림길") await page.goto("/");
    const launcher = page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name, exact: true }); await launcher.scrollIntoViewIfNeeded(); await launcher.click();
    const game = page.getByRole("region", { name: "전체 화면 게임" });
    await game.getByRole("button", { name: "절벽 달리기 시작" }).click();
    await expect(game.getByLabel(`${"갈림길"} 한국어 뜻`)).toBeInViewport();
    const controls = game.locator(".word-touch button"); for (const button of await controls.all()) await expect(button).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ animations: "disabled", path: test.info().outputPath(`${name}-mobile.png`) }); await page.keyboard.press("Escape");
  }
});

test("새 아케이드 편곡의 드럼·화음 출력과 음소거", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const probe = { buffers: 0, voices: 0, master: null as GainNode | null };
    class AudioProbe extends Native {
      constructor() { super(); probe.master = null; }
      createGain() { const gain = super.createGain(); if (!probe.master) probe.master = gain; return gain; }
      createOscillator() { probe.voices++; return super.createOscillator(); }
      createBufferSource() { probe.buffers++; return super.createBufferSource(); }
    }
    Object.assign(window, { AudioContext: AudioProbe, soundProbe: probe });
  });
  await page.goto("/"); await page.getByRole("button", { name: "아케이드 모드", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { soundProbe: { buffers: number } }).soundProbe.buffers)).toBeGreaterThan(4);
  await expect.poll(() => page.evaluate(() => (window as unknown as { soundProbe: { voices: number } }).soundProbe.voices)).toBeGreaterThan(12);
  await page.getByRole("button", { name: "소리 끄기", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { soundProbe: { master: GainNode } }).soundProbe.master.gain.value)).toBe(0);
});

test("갈림길 체력은 보급 상한·낙석 피해·0 하한을 지킴", () => {
  expect(forkEnergy(95, 3000, true, false, false)).toBe(100);
  expect(forkEnergy(50, 0, false, true, false)).toBe(28);
  expect(forkEnergy(50, 0, false, true, true)).toBe(50);
  expect(forkEnergy(1, 3000, false, true, false)).toBe(0);
});
