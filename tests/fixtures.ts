import { test as base } from "@playwright/test";
export * from "@playwright/test";
// 기존 기능 검사는 재방문 상태로 실행합니다. 첫 접속 영상은 opening.spec.ts에서 별도로 검증합니다.
export const test = base.extend<{ returningVisitor: void; chooseBeginner: boolean }>({
  chooseBeginner: [true, { option: true }],
  // 기존 기능 검사도 새 선택 화면에서 실제 초급 버튼을 누릅니다. 잠금/해제 검사는 이를 끕니다.
  page: async ({ page, chooseBeginner }, runFixture) => {
    if (chooseBeginner) await page.addLocatorHandler(page.getByRole("region", { name: "게임 난이도 선택", exact: true }), async () => { await page.getByRole("button", { name: "초급 시작", exact: true }).click(); });
    await runFixture(page);
  },
  returningVisitor: [async ({ context }, runFixture) => {
    await context.addInitScript(() => sessionStorage.setItem("toefl-opening-seen-v1", "1"));
    await runFixture();
  }, { auto: true }],
});
