import { expect, test } from "@playwright/test";

test("엔진 저음·발걸음 필터·정답 선율·박수·글로벌 음소거", async ({ page, context }) => {
  await context.route("**/*", route => { const u = new URL(route.request().url()); return u.hostname === "localhost" && ["3000", "3101"].includes(u.port) ? route.continue() : route.abort(); });
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const probe = { frequencies: [] as number[], filters: [] as { type: string; hz: number }[], master: null as GainNode | null };
    class AudioProbe extends Native {
      createGain() { const gain = super.createGain(); if (!probe.master) probe.master = gain; return gain; }
      createOscillator() { const node = super.createOscillator(); const start = node.start.bind(node); node.start = (when?: number) => { probe.frequencies.push(node.frequency.value); start(when); }; return node; }
      createBiquadFilter() { const filter = super.createBiquadFilter(); const connect = filter.connect.bind(filter); filter.connect = ((...args: Parameters<typeof connect>) => { probe.filters.push({ type: filter.type, hz: filter.frequency.value }); return connect(...args); }) as typeof filter.connect; return filter; }
    }
    Object.assign(window, { AudioContext: AudioProbe, gameAudioProbe: probe });
  });
  await page.goto("/"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "옐로캡 러시", exact: true }).click(); await page.getByRole("button", { name: "출발하기", exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { gameAudioProbe: { frequencies: number[] } }).gameAudioProbe.frequencies.some(hz => hz < 55))).toBe(true);
  await page.keyboard.press("Escape"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "갈림길", exact: true }).click(); await page.getByRole("button", { name: "절벽 달리기 시작" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { gameAudioProbe: { filters: { type: string; hz: number }[] } }).gameAudioProbe.filters.some(filter => filter.type === "lowpass" && filter.hz === 500))).toBe(true);
  await page.keyboard.press("Escape"); await page.getByRole("navigation", { name: "미니게임" }).getByRole("button", { name: "메모리 카드", exact: true }).click(); await page.getByRole("button", { name: "플래시카드 시작" }).click();
  for (let i = 0; i < 6; i++) { await page.getByRole("button", { name: "정답 뒤집기", exact: true }).click(); await page.getByRole("button", { name: "기억했어요", exact: true }).click(); }
  await expect.poll(() => page.evaluate(() => (window as unknown as { gameAudioProbe: { filters: { type: string; hz: number }[] } }).gameAudioProbe.filters.some(filter => filter.type === "bandpass" && filter.hz === 1600))).toBe(true);
  await expect.poll(() => page.evaluate(() => (window as unknown as { gameAudioProbe: { frequencies: number[] } }).gameAudioProbe.frequencies.some(hz => Math.abs(hz - 1318.51) < 1))).toBe(true);
  await page.getByRole("region", { name: "전체 화면 게임" }).getByRole("button", { name: "소리 끄기", exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { gameAudioProbe: { master: GainNode } }).gameAudioProbe.master.gain.value)).toBe(0);
});
