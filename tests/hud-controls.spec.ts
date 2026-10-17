import { test, expect } from "./fixtures";
import { VOCAB } from "../src/lib/vocab";

test.beforeEach(async ({ context }) => { await context.route("**/*", route => { const u=new URL(route.request().url());return u.hostname==="localhost" && ["3000","3101"].includes(u.port)?route.continue():route.abort(); }); });

test("흰색 단어장 트랙·빨간 게이지는 홈·전체·블록에 동일 적용", async ({ page }) => {
  await page.addInitScript(words=>localStorage.setItem("toefl-learning-v1:guest",JSON.stringify({learned:words,stages:{}})),VOCAB.slice(0,50).map(word=>word.word));
  await page.goto("/"); const home=page.getByRole("progressbar",{name:"전체 단어 학습량",exact:true});await expect(home).toHaveAttribute("value","50");
  await page.getByRole("button",{name:"학습한 단어량 열기"}).click();
  for(const bar of await page.locator(".vocab-library progress").all()) {
    const colors=await bar.evaluate(el=>({track:getComputedStyle(el).backgroundColor,fill:getComputedStyle(el).accentColor}));
    expect(colors).toEqual({track:"rgb(255, 255, 255)",fill:"rgb(237, 57, 69)"});
  }
  await page.screenshot({path:test.info().outputPath("red-vocabulary.png")});
});

test("옐로캡 정지 아이콘·남은 시간 유지·판정 중복 없음·바 없는 독립 배지", async ({ page }) => {
  await page.goto("/");await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:"옐로캡 러시",exact:true}).click();
  await page.clock.install({time:new Date(0)});await page.clock.pauseAt(new Date(1000));await page.getByRole("button",{name:"출발하기"}).click();
  const field=page.getByLabel("택시 게임 조작 영역",{exact:true}),word=await field.locator("p.text-3xl").textContent(),item=VOCAB.find(v=>v.word===word)!;
  await field.getByRole("button",{name:new RegExp(`번 차선: ${item.synonym}$`)}).click();await page.clock.fastForward(1200);
  const timer=page.getByRole("progressbar",{name:"택시 판단 남은 시간"}),before=Number(await timer.getAttribute("aria-valuenow"));
  const pause=page.getByRole("button",{name:"일시정지",exact:true});await expect(pause.locator("svg")).toHaveCount(1);await pause.click();
  await page.clock.fastForward(30000);await expect(timer).toHaveAttribute("aria-valuenow",String(before));await expect(field.getByRole("button",{name:new RegExp(`번 차선: ${item.synonym}$`)})).toBeDisabled();
  await expect(page.locator(".game-backdrop video")).toHaveJSProperty("paused",true);await expect(page.locator(".cab-hud,.word-hud,.pop-hud,.game-topline")).toHaveCount(0);
  const controls=page.locator(".game-controls");expect((await controls.getByRole("button",{name:"계속하기"}).boundingBox())!.x).toBeGreaterThan((await controls.getByRole("button",{name:"소리 끄기"}).boundingBox())!.x);
  await page.getByRole("button",{name:"계속하기",exact:true}).click();await page.clock.fastForward(before+50);await expect(field.getByText(/^정답!/)).toBeVisible();
  await page.getByRole("button",{name:"일시정지",exact:true}).click();await page.clock.fastForward(30000);await expect(field.getByText(/^정답!/)).toBeVisible();await page.getByRole("button",{name:"계속하기",exact:true}).click();await page.clock.fastForward(950);await expect(field.locator("p.text-3xl")).not.toHaveText(word!);
  await page.screenshot({path:test.info().outputPath("cab-badges.png")});
});

test("갈림길·워드 팝·메모리의 공통 정지/재개 아이콘과 320px 접근", async ({ page }) => {
  await page.setViewportSize({width:320,height:568});await page.goto("/");
  for(const [name,start,selector] of [["갈림길","절벽 달리기 시작",".cliff-game"],["워드 팝","워드 팝 시작",".word-pop"],["메모리 카드","플래시카드 시작",".boss-game"]]) {
    await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name,exact:true}).click();await page.getByRole("button",{name:start,exact:true}).click();
    const pause=page.getByRole("button",{name:"일시정지",exact:true});await expect(pause).toBeInViewport();await pause.click();await expect(page.locator(selector)).toHaveAttribute("data-paused","true");
    await expect(page.locator(".game-controls").getByRole("button",{name:"계속하기",exact:true})).toBeInViewport();await page.screenshot({path:test.info().outputPath(`${selector.slice(1)}-mobile.png`)});
    await page.getByRole("button",{name:"계속하기",exact:true}).click();await expect(page.locator(selector)).toHaveAttribute("data-paused","false");await page.keyboard.press("Escape");
  }
});
