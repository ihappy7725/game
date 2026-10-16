"use client";

import { useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";

import { deleteStickerImage, importSticker, notifyLibraryChanged, useStickerLibrary } from "@/lib/sticker-library";
import Image from "next/image";

const STICKER_CHOICES = [
  { id: "spark", emoji: "✨", text: "작은 성취도 반짝여" },
  { id: "grow", emoji: "🌱", text: "어제보다 한 걸음" },
  { id: "dream", emoji: "🗽", text: "나의 다음 무대는 미국" },
  { id: "coffee", emoji: "☕", text: "잠깐 쉬어도 괜찮아" },
  { id: "focus", emoji: "🎧", text: "지금은 나에게 집중" },
  { id: "brave", emoji: "🚀", text: "도전하는 내가 좋아" },
];
type Sticker = { id: string; choice?: string; imageId?: string; x: number; y: number };
const KEY = "toefl-motivation-stickers-v1";
const EVENT = "toefl-stickers-change";
let fallback = "[]";
function read() { try { return localStorage.getItem(KEY) ?? fallback; } catch { return fallback; } }
function subscribe(update: () => void) { window.addEventListener(EVENT, update); window.addEventListener("storage", update); return () => { window.removeEventListener(EVENT, update); window.removeEventListener("storage", update); }; }
function save(items: Sticker[]) { fallback = JSON.stringify(items); try { localStorage.setItem(KEY, fallback); } catch { /* 이번 세션에 보관합니다. */ } window.dispatchEvent(new Event(EVENT)); }
function parse(raw: string): Sticker[] { try { const list: unknown = JSON.parse(raw); return Array.isArray(list) ? list.filter((s): s is Sticker => Boolean(s && typeof s.id === "string" && (STICKER_CHOICES.some(c => c.id === s.choice) || typeof s.imageId === "string") && Number.isFinite(s.x) && s.x >= 0 && s.x <= 100 && Number.isFinite(s.y) && s.y >= 0 && s.y <= 100)).slice(0,24) : []; } catch { return []; } }
export function useStickers() {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const items = useMemo(() => parse(raw), [raw]);
  const add = (imageId: string) => { if (items.length < 24) save([...items, { id: crypto.randomUUID(), imageId, x: 15 + items.length % 4 * 18, y: 72 + items.length % 2 * 12 }]); };
  const remove = (id: string) => save(items.filter(s => s.id !== id));
  const move = (id: string, x: number, y: number) => save(items.map(s => s.id === id ? { ...s, x: Math.max(0,Math.min(100,x)), y: Math.max(0,Math.min(100,y)) } : s));
  return { items, add, remove, move };
}
export function StickerPicker() {
  const { items, add, remove } = useStickers();
  const library = useStickerLibrary();
  const [query,setQuery] = useState("");
  const [page,setPage] = useState(0);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const filtered = library.images.filter(image => image.name.toLowerCase().includes(query.toLowerCase()));
  const pages = Math.max(1,Math.ceil(filtered.length/36));
  const currentPage = Math.min(page,pages-1);
  async function upload(files: FileList | null) {
    if(!files || busy) return;
    setBusy(true); setMessage("");
    let added=0; const errors:string[]=[];
    for(const file of Array.from(files)) {
      try { await importSticker(file);added++; } catch(error) { errors.push(error instanceof Error ? error.message : "이미지를 추가하지 못했습니다."); }
    }
    notifyLibraryChanged();setBusy(false);setMessage(`${added}개 이미지를 보관함에 저장했습니다.${errors.length ? " " + errors.join(" ") : ""}`);
  }
  async function deleteImage(id:string) {
    try { await deleteStickerImage(id);save(items.filter(item=>item.imageId!==id));setMessage("보관함 이미지와 붙인 스티커를 삭제했습니다."); }
    catch(error){setMessage(error instanceof Error ? error.message : "이미지를 삭제하지 못했습니다.");}
  }
  return <section aria-label="동기부여 스티커">
    <h2 className="text-2xl font-bold">나만의 이미지 스티커</h2>
    <p className="mt-3 text-sm leading-relaxed text-slate-500">마음에 드는 사진·문구·콜라주를 모아 메인 화면에 붙이세요. 이미지는 이 기기의 브라우저에 보관합니다.</p>
    <label className="mt-6 block text-sm font-semibold">이미지 검색<input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="study motivation, dream campus…" className="mt-2 w-full rounded-xl border border-slate-300 bg-white p-3 font-normal" /></label>
    <div className="mt-3 flex flex-wrap gap-2"><a href={`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(query.trim() || "study motivation stickers")}`} target="_blank" rel="noopener noreferrer" className="hub-primary">Pinterest에서 검색 ↗</a><label className={`hub-small-button ${busy ? "opacity-40" : "cursor-pointer"}`}>이미지 여러 장 추가<input type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/gif" multiple disabled={busy} aria-label="스티커 이미지 파일 추가" className="sr-only" onChange={e=>{void upload(e.target.files);e.currentTarget.value="";}} /></label></div>
    <p className="mt-3 text-xs leading-relaxed text-slate-500">검색 결과는 Pinterest 새 탭에서 열립니다. 원하는 이미지를 직접 저장한 뒤 보관함에 추가하세요. PNG·JPG·WebP·AVIF·GIF, 한 장당 15MB까지. GIF는 첫 프레임으로 저장합니다.</p>
    {message ? <p role="status" className="mt-4 text-sm">{message}</p> : null}
    {library.error ? <p role="alert" className="mt-3 text-sm">{library.error}</p> : null}
    <h3 className="mt-6 font-semibold">내 이미지 보관함 · {library.images.length}개</h3>
    {busy ? <p role="status" className="my-3 text-sm">이미지를 저장하는 중…</p> : null}
    {library.loading ? <p role="status" className="mt-4 text-sm">보관함을 불러오는 중…</p> : filtered.length ? <>
      <div className="sticker-gallery mt-4">{filtered.slice(currentPage*36,currentPage*36+36).map(image=><div key={image.id} className="sticker-gallery-card"><button disabled={items.length>=24} onClick={()=>add(image.id)} aria-label={`${image.name} 스티커 추가`}><span className="sticker-preview"><Image src={image.src} alt="" fill unoptimized sizes="180px" /></span><span className="mt-2 block truncate text-xs">{image.name}</span></button>{image.local ? <button className="mt-2 text-xs text-slate-500 underline" aria-label={`${image.name} 보관함에서 삭제`} onClick={()=>void deleteImage(image.id)}>보관함에서 삭제</button> : null}</div>)}</div>
      {pages>1 ? <div className="mt-4 flex items-center justify-between"><button className="hub-small-button" disabled={currentPage===0} onClick={()=>setPage(currentPage-1)}>이전 이미지</button><span className="text-xs">{currentPage+1}/{pages}</span><button className="hub-small-button" disabled={currentPage===pages-1} onClick={()=>setPage(currentPage+1)}>다음 이미지</button></div> : null}
    </> : <p className="my-7 rounded-2xl bg-slate-100 p-5 text-sm text-slate-500">{library.images.length ? "검색어와 일치하는 이미지가 없습니다." : "아직 이미지가 없습니다. 파일을 여러 장 선택해 나만의 스티커 보관함을 채워 보세요."}</p>}
    <p className="mt-4 text-xs text-slate-500">화면에는 최대 24개를 붙일 수 있습니다. 손잡이를 드래그하거나 선택 후 방향키로 옮기세요. 보관함에서 삭제하면 해당 이미지의 스티커도 지워집니다.</p>
    {items.length ? <div className="mt-6 space-y-2"><h3 className="font-semibold">붙인 스티커 {items.length}/24</h3>{items.map((item,i)=><div key={item.id} className="flex items-center justify-between gap-3 text-sm"><span className="truncate">{library.images.find(image=>image.id===item.imageId)?.name ?? STICKER_CHOICES.find(choice=>choice.id===item.choice)?.text ?? "이미지 스티커"}</span><button onClick={()=>remove(item.id)} aria-label={`스티커 ${i+1} 삭제`} className="hub-small-button">떼기</button></div>)}</div> : null}
  </section>;
}
export function MotivationStickers({ boundsRef }: { boundsRef: RefObject<HTMLDivElement | null> }) {
  const { items, move, remove } = useStickers();
  const library = useStickerLibrary();
  const drag = useRef<{ id: string; x: number; y: number; px: number; py: number; width: number; height: number } | null>(null);
  return <div className="sticker-layer" aria-label="내 동기부여 스티커">{items.map(s => {
    const choice = STICKER_CHOICES.find(c => c.id === s.choice);
    const image = library.images.find(image=>image.id===s.imageId);
    const name = image?.name ?? choice?.text ?? "이미지";
    return <div key={s.id} className={`motivation-sticker ${s.imageId ? "image-sticker" : `sticker-${s.choice}`}`} style={{ left: `${s.x * .78}%`, top: `${s.y * .8}%` }}>
      <button aria-label={`${name} 스티커 이동`} className="sticker-handle" onPointerDown={e => { const bounds = boundsRef.current?.getBoundingClientRect(); if (!bounds) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { id: s.id, x: s.x, y: s.y, px: e.clientX, py: e.clientY, width: bounds.width * .78, height: bounds.height * .8 }; }} onPointerMove={e => { const d=drag.current; if (d?.id === s.id) move(s.id,d.x+(e.clientX-d.px)/d.width*100,d.y+(e.clientY-d.py)/d.height*100); }} onPointerUp={() => { drag.current=null; }} onPointerCancel={() => { drag.current=null; }} onKeyDown={e => { const keys: Record<string,[number,number]> = { ArrowLeft:[-2,0],ArrowRight:[2,0],ArrowUp:[0,-2],ArrowDown:[0,2] }; const delta=keys[e.key]; if(delta) { e.preventDefault(); move(s.id,s.x+delta[0],s.y+delta[1]); } }}><span className="sticker-content">{image ? <Image src={image.src} alt={name} fill unoptimized sizes="180px" draggable={false}/> : choice ? <><span className="text-3xl" aria-hidden>{choice.emoji}</span><span className="block mt-2 text-xs font-bold">{choice.text}</span></> : <span className="text-xs">{library.loading ? "이미지 읽는 중…" : "이미지 없음"}</span>}</span></button>
      <button className="sticker-delete" aria-label={`${name} 스티커 삭제`} onClick={() => remove(s.id)}>×</button>
    </div>;
  })}</div>;
}
