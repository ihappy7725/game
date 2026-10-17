import { test, expect } from "./fixtures";
import { VOCAB } from "../src/lib/vocab";
import { forkDuration } from "../src/lib/word-arcade";

test.beforeEach(async ({ context }) => { await context.route("**/*", route => { const u=new URL(route.request().url());return u.hostname==="localhost" && ["3000","3101"].includes(u.port)?route.continue():route.abort(); }); });

test("네 게임 캡슐은 같은 좌표·크기·둥근 모서리, 상태를 한 곳에 표시", async ({ page }) => {
  for(const viewport of [{width:1280,height:900},{width:320,height:568}]) {
    await page.setViewportSize(viewport);await page.goto("/");let reference:{x:number;y:number;width:number;height:number}|null=null;
    for(const [name,start] of [["옐로캡 러시","출발하기"],["갈림길","절벽 달리기 시작"],["워드 팝","워드 팝 시작"],["메모리 카드","플래시카드 시작"]]) {
      await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name,exact:true}).click();await page.getByRole("button",{name:start,exact:true}).click();await page.getByRole("button",{name:"일시정지",exact:true}).click();
      const hud=page.locator("[data-game-hud]");await expect(hud).toHaveCount(1);await expect(hud).toBeInViewport();const box=(await hud.boundingBox())!;
      if(reference)expect(box).toEqual(reference);else reference=box;
      const styles=await hud.evaluate(el=>({radius:getComputedStyle(el).borderRadius,children:Array.from(el.children).map(child=>({background:getComputedStyle(child).backgroundColor,shadow:getComputedStyle(child).boxShadow}))}));
      expect(styles.radius).toBe("999px");expect(styles.children.every(child=>child.background==="rgba(0, 0, 0, 0)" && child.shadow==="none")).toBe(true);
      if(viewport.width===320 && name==="갈림길")for(const button of await page.locator(".fork-sign").all())await expect(button).toBeInViewport();
      await page.screenshot({path:test.info().outputPath(`capsule-${name}-${viewport.width}.png`)});await page.keyboard.press("Escape");
    }
  }
});

test("갈림길 원화·영상·캐릭터·재질과 실제 분기, 정지·종료 정리", async ({ page }) => {
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto("/");await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:"갈림길",exact:true}).click();
  const world=page.locator(".fork-live-world"),canvas=world.locator("canvas"),video=world.locator("video");
  await expect(world).toHaveAttribute("data-renderer","webgl");await expect(canvas).toHaveAttribute("data-runner","original-art");await expect(canvas).toHaveAttribute("data-materials","sandstone");
  await expect(canvas).toHaveAttribute("data-texture-source","original-art");
  expect(Number(await canvas.getAttribute("data-draw-calls"))).toBeLessThan(80);
  await expect(world.locator(".fork-painted-distance")).toHaveCSS("background-image",/cliff-world-v1.webp/);
  await page.getByRole("button",{name:"절벽 달리기 시작",exact:true}).click();
  await expect.poll(()=>video.evaluate(el=>(el as HTMLVideoElement).currentTime)).toBeGreaterThan(.1);
  const crop=await world.locator(".fork-sky-crop").boundingBox(),movie=await video.boundingBox();expect(crop!.height/movie!.height).toBeCloseTo(.16,2);
  await page.getByRole("button",{name:"일시정지",exact:true}).click();await expect(video).toHaveJSProperty("paused",true);
  await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(1000));const before=await canvas.getAttribute("data-camera");await page.clock.runFor(200);expect(await canvas.getAttribute("data-camera")).toBe(before);
  await page.getByRole("button",{name:"계속하기",exact:true}).click();
  const meaning=await page.getByLabel("갈림길 한국어 뜻").textContent(),word=VOCAB.find(item=>item.meaning===meaning)!.word;
  const sign=page.locator(".fork-sign").filter({hasText:word});await sign.click();await page.clock.fastForward(forkDuration(0,0)+40);await page.clock.runFor(850);
  await expect(world).not.toHaveAttribute("data-heading","0.00");await expect(page.getByLabel("갈림길 기록")).toContainText("1개 통과");
  await page.clock.resume();await page.keyboard.press("Escape");await expect(world).toHaveCount(0);expect(errors).toEqual([]);
});

test("갈림길 영상·캐릭터 원화 실패에도 실시간 길과 모델 유지", async ({ page }) => {
  await page.route("**/backgrounds/fork-loop.mp4",route=>route.fulfill({status:404,body:""}));await page.route("**/arcade/runner-back-v1.webp",route=>route.fulfill({status:404,body:""}));
  await page.goto("/");await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:"갈림길",exact:true}).click();
  await expect(page.locator(".fork-live-world")).toHaveAttribute("data-renderer","webgl");await expect(page.locator(".fork-sky-video")).toHaveAttribute("data-scene-kind","poster");
  await expect(page.locator(".fork-webgl-host canvas")).toHaveAttribute("data-runner","model");await page.getByRole("button",{name:"절벽 달리기 시작",exact:true}).click();await expect(page.getByLabel("갈림길 한국어 뜻")).toBeVisible();
});
