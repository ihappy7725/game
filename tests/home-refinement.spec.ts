import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => { const url=new URL(route.request().url()); return url.hostname==="localhost" && ["3000","3101"].includes(url.port) ? route.continue() : route.abort(); });
});

test("모드 버튼은 정중앙·아이콘 제목과 설명·한낮 원화와 모션 표시", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/토플 유니온.*TOEFL Union/);
  await expect(page.getByRole("link",{name:"토플 유니온 홈"})).toBeVisible();
  expect((await page.request.get("/favicon.ico")).status()).toBe(200);
  for(const mode of ["아케이드 모드","공부 모드"]){
    await page.getByRole("button",{name:mode,exact:true}).click();
    const toggle=await page.getByRole("navigation",{name:"학습 모드"}).boundingBox();expect(toggle!.x+toggle!.width/2).toBeCloseTo(640,0);
    const icons=page.locator(".hub-launchers .launcher-art");await expect(icons).toHaveCount(4);
    const boxes=await icons.evaluateAll(elements=>elements.map(el=>{const rect=el.getBoundingClientRect();return {x:rect.x,y:rect.y,width:rect.width,transform:getComputedStyle(el).transform};}));
    for(const box of boxes){expect(box.width).toBeGreaterThan(140);expect(box.transform).toBe("none");expect(box.y).toBeCloseTo(boxes[0].y,0);}
    expect(boxes[1].x-boxes[0].x).toBeCloseTo(boxes[2].x-boxes[1].x,0);
    expect((boxes[0].x+boxes[3].x+boxes[3].width)/2).toBeCloseTo(640,0);
    await expect(page.locator(".hub-intro,.hub-location")).toHaveCount(0);
    await expect(page.locator(".launcher-label")).toHaveCount(4);await expect(page.locator(".launcher-subtitle")).toHaveCount(4);
    await expect(page.getByText("나만의 미국 유학 준비",{exact:true})).toHaveCount(0);
    const background=page.locator(".learning-hub>.landmark-scene");
    const width=await background.evaluate(async el=>{const url=getComputedStyle(el).backgroundImage.slice(5,-2);const image=new Image();image.src=url;await image.decode();return image.naturalWidth;});expect(width).toBeGreaterThan(1600);
    await expect(background).toHaveAttribute("data-scene-kind","poster");
    await expect(background.locator(".scene-plane")).toHaveCount(0);
    await expect(background).toHaveCSS("background-position","50% 0px");
    await page.mouse.move(10,850);await page.screenshot({animations:"disabled",path:test.info().outputPath(mode==="공부 모드" ? "campus-home.png" : "liberty-home.png")});
  }
});

test("공용 이미지 카탈로그 여러 페이지·선택·Pinterest 검색어 인코딩", async ({page})=>{
  const image=readFileSync("public/backgrounds/campus-cinematic-v1.webp");
  await page.route("**/stickers/catalog.json",route=>route.fulfill({json:Array.from({length:40},(_,i)=>({id:`catalog:${i}`,name:`응원 이미지 ${i+1}`,src:"/stickers/test.webp"}))}));
  await page.route("**/stickers/test.webp",route=>route.fulfill({body:image,contentType:"image/webp"}));
  await page.goto("/");await page.getByRole("button",{name:"동기부여",exact:true}).click();const dialog=page.getByRole("dialog");
  await expect(dialog.getByText("내 이미지 보관함 · 40개",{exact:true})).toBeVisible();await expect(dialog.locator(".sticker-gallery-card")).toHaveCount(36);await dialog.getByRole("button",{name:"다음 이미지"}).click();await expect(dialog.locator(".sticker-gallery-card")).toHaveCount(4);
  await dialog.getByRole("button",{name:"응원 이미지 40 스티커 추가",exact:true}).click();
  await dialog.getByLabel("이미지 검색",{exact:true}).fill("공부 & 꿈");await expect(dialog.getByRole("link",{name:/Pinterest에서 검색/})).toHaveAttribute("href",`https://www.pinterest.com/search/pins/?q=${encodeURIComponent("공부 & 꿈")}`);await expect(dialog.getByRole("link",{name:/Pinterest에서 검색/})).toHaveAttribute("target","_blank");
  await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"응원 이미지 40 스티커 이동"})).toBeVisible();
});

test("중복 파일은 보관함 한 장으로 유지·손상된 파일 오류 안내",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"동기부여",exact:true}).click();const dialog=page.getByRole("dialog");const input=dialog.getByLabel("스티커 이미지 파일 추가");
  await input.setInputFiles(["public/backgrounds/campus-cinematic-v1.webp","public/backgrounds/campus-cinematic-v1.webp"]);await expect(dialog.getByText("내 이미지 보관함 · 1개",{exact:true})).toBeVisible();
  await input.setInputFiles({name:"broken.png",mimeType:"image/png",buffer:Buffer.from("invalid image")});await expect(dialog.getByText(/broken.png: 이미지 내용을 읽을 수 없습니다/)).toBeVisible();
  await input.setInputFiles({name:"notes.txt",mimeType:"text/plain",buffer:Buffer.from("not a picture")});await expect(dialog.getByText(/notes.txt: PNG/)).toBeVisible();await expect(dialog.getByText("내 이미지 보관함 · 1개",{exact:true})).toBeVisible();
});

test("기존에 붙인 문구 스티커는 보존하면서 새 선택기는 이미지 보관함만 표시",async({page})=>{
  await page.addInitScript(()=>localStorage.setItem("toefl-motivation-stickers-v1",JSON.stringify([{id:"legacy",choice:"grow",x:20,y:70}])));
  await page.goto("/");await expect(page.getByRole("button",{name:"어제보다 한 걸음 스티커 이동"})).toBeVisible();await page.getByRole("button",{name:"동기부여",exact:true}).click();const dialog=page.getByRole("dialog");await expect(dialog.getByRole("button",{name:/스티커 추가/})).toHaveCount(0);await expect(dialog.getByText(/아직 이미지가 없습니다/)).toBeVisible();
});
