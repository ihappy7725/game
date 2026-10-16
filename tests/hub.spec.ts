import { expect, test, type Page } from "@playwright/test";
import { deriveProgression } from "../src/lib/progression";
import type { InventoryItem } from "../src/lib/api";

test.beforeEach(async ({context})=>{
  await context.route("**/*",route=>{const url=new URL(route.request().url());return url.hostname==="localhost" && ["3000","3101"].includes(url.port) ? route.continue() : route.abort();});
});
async function login(page: Page) {
  await page.goto("/login");await page.getByLabel("이메일",{exact:true}).fill("learner@example.test");await page.getByLabel("비밀번호").fill("local-test-password");await page.getByRole("button",{name:"로그인",exact:true}).click();await expect(page).toHaveURL(/\/history$/);await page.goto("/");
}
const lamp:InventoryItem={item_id:"lamp",name:"램프",emoji:"💡",rarity:"rare",description:null,quantity:1,placed:true,placed_x:50,placed_y:50};

test("아케이드 기본 진입·모드 저장·원본 사진과 Dock 없는 밝은 홈",async({page})=>{
  await page.goto("/");await expect(page.locator("[data-hub-mode]")).toHaveAttribute("data-hub-mode","arcade");
  await expect(page.getByRole("navigation",{name:"미니게임"}).getByRole("button")).toHaveCount(4);
  await expect(page.getByRole("navigation",{name:"앱 독"})).toHaveCount(0);await expect(page.locator(".hub-main img")).toHaveCount(0);
  await expect(page.getByLabel("내 동기부여 스티커").locator(".motivation-sticker")).toHaveCount(0);
  await page.screenshot({animations:"disabled",path:test.info().outputPath("arcade-home.png")});
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();await expect(page.getByRole("navigation",{name:"공부 영역"}).getByRole("button")).toHaveCount(4);
  await page.screenshot({animations:"disabled",path:test.info().outputPath("study-home.png")});await page.reload();await expect(page.locator("[data-hub-mode]")).toHaveAttribute("data-hub-mode","study");
});

test("실제 Web Audio 합성·모드 변경·소리 저장과 로컬 음원 음소거",async({page})=>{
  await page.addInitScript(()=>{
    const Native=window.AudioContext;const contexts:{context:AudioContext;gains:GainNode[];frequencies:number[]}[]=[];
    class Probe extends Native {
      probe={context:this as AudioContext,gains:[] as GainNode[],frequencies:[] as number[]};
      constructor(){super();contexts.push(this.probe);}
      createGain(){const node=super.createGain();this.probe.gains.push(node);return node;}
      createOscillator(){const node=super.createOscillator();const start=node.start.bind(node);node.start=(when?:number)=>{this.probe.frequencies.push(node.frequency.value);start(when);};return node;}
    }
    Object.assign(window,{AudioContext:Probe,audioProbes:contexts});
  });
  await page.goto("/");await page.getByRole("button",{name:"공부 모드",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioProbes:{frequencies:number[]}[]}).audioProbes[0]?.frequencies.length??0)).toBeGreaterThan(3);
  const rms=await page.evaluate(async()=>{
    const {context,gains}=(window as unknown as {audioProbes:{context:AudioContext;gains:GainNode[]}[]}).audioProbes[0];
    const analyser=context.createAnalyser();gains[0].connect(analyser);analyser.connect(context.destination);
    const values=new Float32Array(analyser.fftSize);let peak=0;
    for(let i=0;i<12;i++){await new Promise(resolve=>setTimeout(resolve,80));analyser.getFloatTimeDomainData(values);peak=Math.max(peak,Math.sqrt(values.reduce((sum,value)=>sum+value*value,0)/values.length));}
    analyser.disconnect();return peak;
  });expect(rms).toBeGreaterThan(0.001);
  await page.getByRole("button",{name:"소리 끄기",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>(window as unknown as {audioProbes:{gains:GainNode[]}[]}).audioProbes[0].gains[0].gain.value)).toBeLessThan(.001);
  await page.reload();await expect(page.getByRole("button",{name:"소리 켜기",exact:true})).toBeVisible();
  await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리스닝/}).click();
  expect(await page.locator("audio").evaluate(el=>(el as HTMLAudioElement).muted)).toBe(true);
});

test("이미지 여러 장 보관·검색·붙이기·드래그·방향키·새로고침·삭제",async({page})=>{
  await page.goto("/");await page.getByRole("complementary",{name:"나의 도구"}).getByRole("button",{name:"동기부여",exact:true}).click();
  const dialog=page.getByRole("dialog");
  await dialog.getByLabel("스티커 이미지 파일 추가").setInputFiles(["public/backgrounds/campus-cinematic-v1.webp","public/backgrounds/liberty-cinematic-v1.webp"]);
  await expect(dialog.getByText("내 이미지 보관함 · 2개",{exact:true})).toBeVisible();
  await dialog.getByLabel("이미지 검색",{exact:true}).fill("campus");
  await expect(dialog.getByRole("button",{name:"liberty-cinematic-v1 스티커 추가"})).toHaveCount(0);
  await expect(dialog.getByRole("link",{name:/Pinterest에서 검색/})).toHaveAttribute("href","https://www.pinterest.com/search/pins/?q=campus");
  await dialog.getByRole("button",{name:"campus-cinematic-v1 스티커 추가",exact:true}).click();await page.keyboard.press("Escape");
  const sticker=page.getByRole("button",{name:"campus-cinematic-v1 스티커 이동"});const first=await sticker.boundingBox();expect(first).toBeTruthy();
  await sticker.focus();await page.keyboard.press("ArrowRight");const second=await sticker.boundingBox();expect(second!.x).toBeGreaterThan(first!.x);
  await page.mouse.move(second!.x+25,second!.y+20);await page.mouse.down();await page.mouse.move(second!.x+130,second!.y-60,{steps:8});await page.mouse.up();
  const moved=await sticker.boundingBox();expect(moved!.x).toBeGreaterThan(second!.x+40);
  await page.reload();await expect(sticker).toBeVisible();await expect.poll(()=>sticker.locator("img").evaluate(img=>(img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);expect((await sticker.boundingBox())!.x).toBeCloseTo(moved!.x,0);
  await page.getByRole("button",{name:"campus-cinematic-v1 스티커 삭제"}).click();await expect(sticker).toHaveCount(0);
  await page.getByRole("complementary",{name:"나의 도구"}).getByRole("button",{name:"동기부여",exact:true}).click();await dialog.getByRole("button",{name:"campus-cinematic-v1 보관함에서 삭제"}).click();await expect(dialog.getByText("내 이미지 보관함 · 1개",{exact:true})).toBeVisible();
});

test("성장 조건은 배치 종류와 실제 주간 순위로 계산",()=>{
  expect(deriveProgression([],null).level).toBe(0);expect(deriveProgression([{...lamp,quantity:100}],null).points).toBe(2);
  expect(deriveProgression([{...lamp,placed:false}],null).points).toBe(0);
  expect(deriveProgression([lamp,{...lamp,item_id:"plant",rarity:"common"}],null).level).toBe(1);
  expect(deriveProgression([{...lamp,rarity:"legendary"},{...lamp,item_id:"poster",rarity:"epic"}],null).level).toBe(2);
  expect(deriveProgression([],20).level).toBe(1);expect(deriveProgression([],5).level).toBe(2);expect(deriveProgression([],21).level).toBe(0);
});

test("모의 계정으로 심화 문제·난이도 해제·주간 기록 공유·로그아웃 초기화",async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.addInitScript(()=>Object.defineProperty(navigator,"share",{configurable:true,value:undefined}));
  await page.route("**/api/game/inventory",route=>route.fulfill({json:{items:[]}}));
  await page.route("**/api/game/leaderboard?**",route=>route.fulfill({json:{rows:[{rank:12,display_name:"나의 연습",earned_this_week:600,is_me:true}],my_rank:12}}));
  await login(page);await expect(page.getByRole("button",{name:/도전자 · 성장 보기/})).toBeVisible();
  await page.getByRole("button",{name:/도전자 · 성장 보기/}).click();await page.getByRole("button",{name:"내 주간 기록 공유"}).click();await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain("12위");await page.keyboard.press("Escape");
  await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:/서브웨이 점프/}).click();const dialog=page.getByRole("dialog");await expect(dialog.getByRole("button",{name:/🔒 도전/})).toBeDisabled();await dialog.getByRole("button",{name:/✦ 심화/}).click();await expect(page.getByRole("region",{name:"전체 화면 게임"})).toContainText("점프 기회 3번");await page.keyboard.press("Escape");
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리딩/}).click();await expect(page.getByText(/현재 6\/9문제 해제/)).toBeVisible();await page.getByRole("button",{name:"6",exact:true}).click();await page.getByRole("button",{name:"홈으로",exact:true}).click();
  await page.getByRole("button",{name:"로그아웃",exact:true}).click();await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리딩/}).click();await expect(page.getByText(/현재 3\/9문제 해제/)).toBeVisible();await expect(page.getByRole("button",{name:"🔒 6",exact:true})).toBeDisabled();
});

test("기본 읽기 정답·해설 유지와 듣기 로컬 음원 접근",async({page})=>{
  await page.goto("/");await page.getByRole("button",{name:"공부 모드",exact:true}).click();await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리딩/}).click();await page.getByLabel("Unused land").check();await page.getByRole("button",{name:"정답과 해설"}).click();await expect(page.getByText(/정답이에요!/)).toBeVisible();await page.getByRole("button",{name:"홈으로",exact:true}).click();await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리스닝/}).click();await expect(page.getByRole("heading",{name:"Listening 연습실"})).toBeVisible();await expect.poll(()=>page.locator("audio").evaluate(el=>(el as HTMLAudioElement).duration)).toBeGreaterThan(20);
});

test("모바일 홈은 네 아이콘을 스크롤하고 우측 도구와 소리 버튼 접근",async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:"reduce"});await page.goto("/");await page.screenshot({animations:"disabled",path:test.info().outputPath("arcade-mobile.png")});
  await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:/메모리 카드/}).scrollIntoViewIfNeeded();await page.getByRole("button",{name:"소리 끄기",exact:true}).click();await expect(page.getByRole("button",{name:"소리 켜기",exact:true})).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test("모의 책상 배치 저장으로 마스터 해제·세 액션 게임 도전 난이도와 9문제",async({page})=>{
  const items=[{...lamp,rarity:"legendary",placed:false},{...lamp,item_id:"poster",name:"캠퍼스 포스터",rarity:"epic",placed:true}];
  let writes=0;
  await page.route("**/api/game/inventory",route=>route.fulfill({json:{items}}));
  await page.route("**/api/game/leaderboard?**",route=>route.fulfill({json:{rows:[],my_rank:null}}));
  await page.route("**/api/game/inventory/place",route=>{writes++;const body=route.request().postDataJSON();Object.assign(items[0],{placed:body.placed,placed_x:body.x,placed_y:body.y});return route.fulfill({json:items[0]});});
  await page.route("**/api/game/mistakes?**",route=>route.fulfill({json:{items:[]}}));
  await login(page);await expect(page.getByRole("button",{name:/도전자 · 성장 보기/})).toBeVisible();
  await page.getByRole("complementary",{name:"나의 도구"}).getByRole("button",{name:"나의 책상 꾸미기"}).click();
  const room=page.getByRole("dialog");await room.getByRole("button",{name:/램프 · 1개/}).click();await room.getByLabel("책상에 배치",{exact:true}).check();await room.getByRole("button",{name:"배치 저장",exact:true}).click();await expect(room.getByText("책상 배치를 저장했습니다.")).toBeVisible();await page.keyboard.press("Escape");
  await expect(page.getByRole("button",{name:/마스터 · 성장 보기/})).toBeVisible();expect(writes).toBe(1);
  for(const [name,text] of [["옐로캡 러시","1.95초"],["갈림길","2.5초"],["서브웨이 점프","점프 기회 2번"]]){
    await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:new RegExp(name)}).click();await page.getByRole("dialog").getByRole("button",{name:/✦ 도전/}).click();

    await expect(page.getByRole("region",{name:"전체 화면 게임"})).toContainText(text);await page.keyboard.press("Escape");
  }
  await page.getByRole("button",{name:"공부 모드",exact:true}).click();await page.getByRole("navigation",{name:"공부 영역"}).getByRole("button",{name:/리딩/}).click();await expect(page.getByText(/현재 9\/9문제 해제/)).toBeVisible();await page.getByRole("button",{name:"9",exact:true}).click();await page.getByLabel("Randomly assign similar students while holding practice materials constant").check();await page.getByRole("button",{name:"정답과 해설"}).click();await expect(page.getByRole("region",{name:"리딩 연습",exact:true}).getByRole("status")).toContainText("정답이에요!");
});
