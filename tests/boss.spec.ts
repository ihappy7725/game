import { expect,test,type Page } from "@playwright/test";

test.beforeEach(async({context})=>{await context.route("**/*",route=>{const url=new URL(route.request().url());return url.hostname==="localhost" && ["3000","3101"].includes(url.port) ? route.continue() : route.abort();});});
async function openBoss(page:Page){await page.getByRole("navigation",{name:"미니게임"}).getByRole("button",{name:/메모리 카드/}).click();return page.getByRole("region",{name:"오답 보스전",exact:true});}
async function login(page:Page){await page.goto("/login");await page.getByLabel("이메일",{exact:true}).fill("learner@example.test");await page.getByLabel("비밀번호").fill("local-test-password");await page.getByRole("button",{name:"로그인",exact:true}).click();await expect(page).toHaveURL(/\/history$/);await page.goto("/");}
const sample={id:"one",source:"reading",prompt:"What is the author's main claim?",correct_answer:"Urban gardens strengthen communities.",times_wrong:1,times_right:0,resolved:false,last_wrong_at:"2026-10-16"};
async function finishOne(page:Page){const game=await openBoss(page);await game.getByRole("button",{name:"플래시카드 시작"}).click();await game.getByRole("button",{name:"정답 뒤집기"}).click();await game.getByRole("button",{name:"기억했어요"}).click();return game;}

test("예제 플래시카드 뒤집기·기억/재복습 분류·공유·저장 호출 없음",async({page})=>{
  let writes=0;await page.route("**/api/game/**",route=>{if(route.request().method()==="POST")writes++;return route.continue();});
  await page.addInitScript(()=>{Object.defineProperty(navigator,"share",{configurable:true,value:async(data:ShareData)=>Object.assign(window,{sharedScore:data.text})});});
  await page.goto("/");const game=await openBoss(page);await game.getByRole("button",{name:"플래시카드 시작"}).click();
  for(let i=0;i<6;i++){await game.getByRole("button",{name:"정답 뒤집기"}).press("Space");await expect(game.getByRole("button",{name:"카드 앞면 보기"})).toBeVisible();await game.getByRole("button",{name:i===5 ? "다시 볼게요" : "기억했어요"}).click();}
  await expect(game.getByRole("heading",{name:"오늘의 복습 완료"})).toBeVisible();await expect(game.getByText("기억했어요 5장 · 다시 볼 카드 1장",{exact:true})).toBeVisible();await game.getByRole("button",{name:"게임 점수 공유"}).click();expect(await page.evaluate(()=>(window as unknown as {sharedScore:string}).sharedScore)).toContain("500점");expect(writes).toBe(0);await page.screenshot({animations:"disabled",path:test.info().outputPath("flashcards.png")});await page.keyboard.press("Escape");await expect(game).toHaveCount(0);
});

test("영역별 오답을 조회하고 원래 source를 유지해 자가 복습 저장·중복 방지",async({page})=>{
  const writes:Record<string,unknown>[]=[];
  await page.route("**/api/game/mistakes?**",route=>{expect(route.request().headers().authorization).toMatch(/^Bearer /);expect(new URL(route.request().url()).searchParams.has("source")).toBe(false);return route.fulfill({json:{items:[sample]}});});
  await page.route("**/api/game/mistakes",route=>{writes.push(route.request().postDataJSON());return route.fulfill({json:{}});});
  await login(page);const game=await finishOne(page);expect(writes).toHaveLength(0);await game.getByRole("button",{name:"오답 복습 저장"}).dblclick();await expect(game.getByRole("status")).toContainText("자가 복습 결과를 저장했습니다");expect(writes).toHaveLength(1);expect(writes[0]).toMatchObject({source:"reading",prompt:sample.prompt,correct_answer:sample.correct_answer,was_correct:true});
});

test("오답 조회 실패 구분·예제 전환·제한 시간 없음·Esc 종료",async({page})=>{
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.route("**/api/game/mistakes?**",route=>route.fulfill({status:503,json:{detail:"모의 오류"}}));await login(page);await openBoss(page);await expect(page.getByRole("region",{name:"전체 화면 게임"}).getByRole("alert")).toContainText("게임 서버 설정");await page.getByRole("button",{name:"예제 카드 연습"}).click();await page.clock.install();const game=page.getByRole("region",{name:"오답 보스전",exact:true});await game.getByRole("button",{name:"플래시카드 시작"}).click();await page.clock.fastForward(60_000);await expect(game.getByRole("button",{name:"정답 뒤집기"})).toBeVisible();await expect(game.getByText("카드 1/6 · 기억한 카드 0장",{exact:true})).toBeVisible();await page.keyboard.press("Escape");await page.clock.fastForward(60_000);expect(errors).toEqual([]);await expect(game).toHaveCount(0);
});

test("오답 저장 응답 유실은 자동 재전송 없이 안내",async({page})=>{
  let writes=0;await page.route("**/api/game/mistakes?**",route=>route.fulfill({json:{items:[sample]}}));await page.route("**/api/game/mistakes",route=>{writes++;return route.abort();});
  await login(page);const game=await finishOne(page);await game.getByRole("button",{name:"오답 복습 저장"}).click();await expect(game.getByRole("status")).toContainText("재전송하지 않습니다");await expect(game.getByRole("button",{name:"오답 복습 저장"})).toBeDisabled();expect(writes).toBe(1);
});
