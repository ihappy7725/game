"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import Image from "next/image";
import { Headphones, Mic, PenLine, BookOpen, CarFront, Split, Bubbles, Ghost, Armchair, Gift, Trophy, Smile, History, Volume2, VolumeX, ArrowLeft, X, Maximize, Minimize } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { WritingWorkspace } from "@/components/WritingWorkspace";
import { SpeakingWorkspace } from "@/components/SpeakingWorkspace";
import { HistoryWorkspace } from "@/components/HistoryWorkspace";
import { DormWorkspace } from "@/components/dorm/DormWorkspace";
import { GameStatus } from "@/components/os/GameStatus";
import { YellowCabRush } from "@/components/arcade/YellowCabRush";
import { CliffForkRun } from "@/components/arcade/CliffForkRun";
import { WordPop } from "@/components/arcade/WordPop";
import { MemoryBossRaid } from "@/components/arcade/MemoryBossRaid";
import { useOsTheme } from "@/lib/os-theme";
import { useSoundscape } from "@/lib/useSoundscape";
import { useProgression } from "@/lib/progression";
import { useBrowserFullscreen } from "@/lib/useBrowserFullscreen";
import { GameBackdrop } from "@/components/arcade/GameBackdrop";
import { OpeningSequence, useOpeningSequence } from "./OpeningSequence";
import { LandmarkScene } from "./LandmarkScene";
import { MotivationStickers, StickerPicker } from "./MotivationStickers";
import { StudyPractice } from "./StudyPractice";
import { VocabularyLibrary, VocabularyProgressButton } from "./VocabularyLibrary";
import { GamePauseProvider, GamePauseButton } from "@/components/arcade/GamePause";
import { GameDifficultySelect } from "@/components/arcade/GameDifficultySelect";
import { unlockedDifficulty, useLearningProgress } from "@/lib/learning-progress";
import { ProgressPanel } from "./ProgressPanel";

type GameId = "cab" | "fork" | "pop" | "boss";
type Entry = { id: string; label: string; subtitle: string; color: string; Icon: ComponentType<{ size?: number; strokeWidth?: number }> };
const STUDY: Entry[] = [
  { id:"listening",label:"리스닝",subtitle:"귀를 열고, 단서를 찾아요",color:"mint",Icon:Headphones },
  { id:"speaking",label:"스피킹",subtitle:"생각을 목소리로",color:"peach",Icon:Mic },
  { id:"writing",label:"라이팅",subtitle:"한 문장씩 단단하게",color:"lavender",Icon:PenLine },
  { id:"reading",label:"리딩",subtitle:"문장 너머의 의미를 읽어요",color:"butter",Icon:BookOpen },
];
const GAMES: Entry[] = [
  { id:"cab",label:"옐로캡 러시",subtitle:"단어를 싣고 달려요",color:"butter",Icon:CarFront },
  { id:"fork",label:"갈림길",subtitle:"단어를 고르고 절벽을 달려요",color:"peach",Icon:Split },
  { id:"pop",label:"워드 팝",subtitle:"단어를 맞추고 연쇄 팡!",color:"mint",Icon:Bubbles },
  { id:"boss",label:"메모리 카드",subtitle:"한 장씩 다시 만나는 오답",color:"lavender",Icon:Ghost },
];
const SIDE = [ {id:"room",label:"나의 책상 꾸미기",Icon:Armchair},{id:"gacha",label:"아이템 뽑기",Icon:Gift},{id:"ranking",label:"주간 랭킹",Icon:Trophy},{id:"motivation",label:"동기부여",Icon:Smile} ];

export function LearningHub() {
  const opening = useOpeningSequence();
  const { mode,setMode } = useOsTheme();
  const progress = useProgression();
  const learning = useLearningProgress();
  const [game,setGame] = useState<GameId|null>(null);
  const [difficulty,setDifficulty] = useState<number | null>(null);
  const [active,setActive] = useState<string|null>(null);
  const [mounted,setMounted] = useState<string[]>([]);
  const [deskTab,setDeskTab] = useState("room");
  const [drawer,setDrawer] = useState<string|null>(null);
  const boundsRef=useRef<HTMLDivElement>(null);
  const gameRef=useRef<HTMLDivElement>(null);
  const dialogRef=useRef<HTMLDivElement>(null);
  const returnFocus=useRef<HTMLElement|null>(null);
  const sound=useSoundscape(mode, Boolean(opening.active || active==="speaking" || active==="listening"), game ? 0.65 : 1, game === "boss" ? "cards" : game);
  const fullscreen=useBrowserFullscreen(()=>setGame(null));
  const isDialog=Boolean(drawer);
  useEffect(() => {
    if(active) document.getElementById(`workspace-${active}`)?.focus();
    else returnFocus.current?.focus();
  },[active]);
  useEffect(()=>{
    if(!game) { returnFocus.current?.focus(); return; }
    gameRef.current?.focus();
    const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();setGame(null);returnFocus.current?.focus();}};
    window.addEventListener("keydown",escape);return()=>window.removeEventListener("keydown",escape);
  },[game]);
  useEffect(()=>{
    if(!isDialog) return;
    const previous=document.activeElement as HTMLElement|null; dialogRef.current?.focus();
    const handle=(e:KeyboardEvent)=>{
      if(e.key==="Escape"){e.preventDefault();setDrawer(null);}
      if(e.key!=="Tab")return;
      const nodes=Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select,textarea,[tabindex="0"]')??[]).filter(el=>el.getClientRects().length>0);
      if(!nodes.length){e.preventDefault();return;}
      if(e.shiftKey && (document.activeElement===nodes[0] || document.activeElement===dialogRef.current)){e.preventDefault();nodes.at(-1)?.focus();}
      else if(!e.shiftKey && (document.activeElement===nodes.at(-1) || document.activeElement===dialogRef.current)){e.preventDefault();nodes[0].focus();}
    };
    document.addEventListener("keydown",handle);return()=>{document.removeEventListener("keydown",handle);previous?.focus();};
  },[isDialog]);
  function openStudy(id:string){returnFocus.current=document.activeElement as HTMLElement;sound.click();if(!mounted.includes(id))setMounted([...mounted,id]);setActive(id);}
  function launch(id:GameId){sound.click();returnFocus.current=document.activeElement as HTMLElement;setDifficulty(null);setGame(id);}
  function changeMode(next:"study"|"arcade"){sound.click();setActive(null);setMode(next);}
  const title=STUDY.find(e=>e.id===active)?.label ?? "학습 기록";
  const closeStudy=()=>{setMounted(mounted.filter(id=>id!==active));setActive(null);};
  return <div className={`learning-hub mode-${mode}`} data-hub-mode={mode}>
    <LandmarkScene mode={mode} moving={!opening.active && !game && !active && !isDialog} />
    <div inert={Boolean(opening.active || game || isDialog || active)} className="hub-shell">
      <header className="hub-header">
        <Link className="hub-brand" href="/" aria-label="토플 유니온 홈"><Image src="/brand/toefl-union-icon-v2.webp" width={42} height={42} alt="" className="union-brand-icon"/><span>TOEFL <b>Union</b></span></Link>
        <nav className="mode-switch" aria-label="학습 모드"><button aria-pressed={mode==="study"} onClick={()=>changeMode("study")}>공부 모드</button><button aria-pressed={mode==="arcade"} onClick={()=>changeMode("arcade")}>아케이드 모드</button></nav>
        <div className="hub-account"><button className="hub-history" onClick={()=>openStudy("history")} aria-label="학습 기록"><History size={18}/></button><AuthStatus/>{fullscreen.supported ? <button data-fullscreen-control className="sound-button" aria-label={fullscreen.active ? "전체화면 해제" : "전체화면으로 보기"} onClick={fullscreen.toggle} title="전체화면 · Esc로 해제">{fullscreen.active ? <Minimize size={18}/> : <Maximize size={18}/>}</button> : null}<SoundButton sound={sound}/></div>
      </header>
      <main ref={boundsRef} className="hub-main" aria-label="나의 학습 놀이터">
        <nav className="hub-launchers" aria-label={mode==="arcade" ? "미니게임" : "공부 영역"}>{(mode==="arcade" ? GAMES : STUDY).map(entry=><button key={entry.id} aria-label={entry.label} title={`${entry.label} · ${entry.subtitle}`} className={`launcher launcher-${entry.color}`} onClick={()=>mode==="arcade" ? launch(entry.id as GameId) : openStudy(entry.id)}><span className="launcher-art"><entry.Icon size={60} strokeWidth={1.5}/><span className="launcher-glint"/></span><span className="launcher-caption"><span className="launcher-label">{entry.label}</span><span className="launcher-subtitle">{entry.subtitle}</span></span></button>)}</nav>
        <MotivationStickers boundsRef={boundsRef}/>
      </main>
      <aside className="hub-tools" aria-label="나의 도구">{SIDE.map(item=><button key={item.id} onClick={()=>{sound.click();setDrawer(item.id);if(["room","gacha","ranking"].includes(item.id))setDeskTab(item.id);}}><span><item.Icon size={23}/></span><small>{item.label}</small></button>)}</aside>
      <VocabularyProgressButton onClick={()=>{sound.click();setDrawer("vocabulary");}}/>
      <footer className="hub-footer"><GameStatus/><button onClick={()=>setDrawer("growth")} className="growth-chip"><span aria-hidden>🌱</span> {progress.loading ? "성장 확인 중" : progress.error ? "성장 정보 확인" : `${progress.title} · 성장 보기`}</button><span className="sound-caption" role="status">{sound.unavailable ? "이 브라우저에서 소리를 시작하지 못했어요" : sound.muted ? "소리 꺼짐" : !sound.started ? "첫 클릭으로 배경음악이 시작돼요" : mode==="arcade" ? "♪ 유니온 시티 그루브" : "♪ 조용한 캠퍼스 피아노"}</span>{fullscreen.message ? <span role="status">{fullscreen.message}</span> : null}</footer>
    </div>
    {mounted.map(id=><section key={id} id={`workspace-${id}`} tabIndex={-1} hidden={id!==active || Boolean(game || isDialog)} className={`workspace-page ${id==="reading" || id==="listening" ? "workspace-light" : "workspace-dark"}`} aria-label={STUDY.find(e=>e.id===id)?.label ?? "학습 기록"}>
      <header className="workspace-header"><button className="hub-small-button" onClick={()=>setActive(null)}><ArrowLeft size={16}/> 홈으로</button><h2>{title}</h2><button className="hub-small-button" onClick={closeStudy}><X size={16}/> 닫기</button></header>
      <div className="workspace-content">{id==="writing" ? <WritingWorkspace embedded/> : id==="speaking" ? <SpeakingWorkspace embedded active={id===active && !game && !isDialog}/> : id==="history" ? <HistoryWorkspace embedded/> : <StudyPractice section={id as "reading"|"listening"} active={id===active && !game && !isDialog}/>}</div>
    </section>)}
    {game ? <GamePauseProvider key={`${game}-${learning.owner}-${difficulty}`}><div className={`game-fullscreen game-${game}`} ref={gameRef} tabIndex={-1} role="region" aria-label="전체 화면 게임">{game !== "fork" ? <GameBackdrop game={game === "boss" ? "cards" : game}/> : null}<div className="game-controls"><div className="flex items-center gap-3"><SoundButton sound={sound}/><GamePauseButton game={game === "boss" ? "cards" : game}/><button aria-label="게임 나가기 Esc" onClick={()=>{setGame(null);returnFocus.current?.focus();}} className="game-exit">나가기 ESC</button></div></div><div className="game-stage">{difficulty === null || difficulty > unlockedDifficulty(learning.record,game) ? <GameDifficultySelect game={game} onSelect={setDifficulty}/> : <div key={`${game}-${learning.owner}-${difficulty}`} className="game-content">{game==="cab" ? <YellowCabRush difficulty={difficulty}/> : game==="fork" ? <CliffForkRun difficulty={difficulty}/> : game==="pop" ? <WordPop difficulty={difficulty}/> : <MemoryBossRaid difficulty={difficulty}/>}</div>}</div></div></GamePauseProvider> : null}
    {<div hidden={!isDialog} className="hub-scrim" onPointerDown={e=>{if(e.target===e.currentTarget){setDrawer(null);}}}><div ref={dialogRef} role="dialog" aria-modal="true" aria-label={drawer==="vocabulary" ? "학습한 단어량" : SIDE.find(s=>s.id===drawer)?.label ?? "나의 성장과 도전"} tabIndex={-1} className={`hub-drawer ${drawer==="vocabulary" ? "vocab-dialog" : ""} ${drawer && ["room","gacha","ranking"].includes(drawer) ? "drawer-desk" : ""}`}><button className="drawer-close" aria-label="패널 닫기" onClick={()=>{setDrawer(null);}}><X size={22}/></button>
      {drawer==="vocabulary" ? <VocabularyLibrary/> : drawer==="motivation" ? <StickerPicker/> : drawer==="growth" ? <ProgressPanel/> : null}
      <div hidden={!drawer || !["room","gacha","ranking"].includes(drawer)}><h2 className="mb-6 text-2xl font-bold">{SIDE.find(s=>s.id===drawer)?.label}</h2><DormWorkspace tab={deskTab} onTabChange={setDeskTab}/>{drawer==="ranking" ? <div className="ranking-growth"><ProgressPanel/></div> : null}</div>
    </div></div>}
    {opening.active ? <OpeningSequence sequence={opening} muted={sound.muted} toggleSound={sound.toggle}/> : null}
  </div>;
}
function SoundButton({ sound }: { sound: ReturnType<typeof useSoundscape> }) { return <button className="sound-button" aria-label={sound.muted ? "소리 켜기" : "소리 끄기"} aria-pressed={!sound.muted} onClick={sound.toggle} title={sound.muted ? "소리 켜기" : "소리 끄기"}>{sound.muted ? <VolumeX size={20}/> : <Volume2 size={20}/>}</button>; }
