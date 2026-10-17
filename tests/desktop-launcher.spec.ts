import { test, expect } from "@playwright/test";
import { attachDesktopWindow } from "../scripts/desktop-window.mjs";

test("전용 실행기는 사용자 클릭 전에 창 전체화면·오프닝, Esc 해제 후 유지", async ({ page,context }) => {
  await context.route("**/*",route=>{const u=new URL(route.request().url());return u.hostname==="localhost" && ["3000","3101"].includes(u.port)?route.continue():route.abort();});
  const session=await attachDesktopWindow(context,page),{windowId}=await session.send("Browser.getWindowForTarget");
  expect((await session.send("Browser.getWindowBounds",{windowId})).bounds.windowState).toBe("fullscreen");
  await page.goto("/");await expect(page.getByRole("dialog",{name:"토플 유니온 오프닝"})).toBeVisible();
  expect((await session.send("Browser.getWindowBounds",{windowId})).bounds.windowState).toBe("fullscreen");
  await page.keyboard.press("Escape");await expect(page.getByRole("dialog",{name:"토플 유니온 오프닝"})).toHaveCount(0);
  await expect.poll(async()=>(await session.send("Browser.getWindowBounds",{windowId})).bounds.windowState).toBe("normal");
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();expect((await session.send("Browser.getWindowBounds",{windowId})).bounds.windowState).toBe("normal");
});
