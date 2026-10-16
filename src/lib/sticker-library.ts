"use client";

import { useEffect, useReducer, useState } from "react";

type StoredImage = { id: string; name: string; blob: Blob };
export type StickerImage = { id: string; name: string; src: string; local: boolean };
const EVENT = "toefl-sticker-library-change";
let database: Promise<IDBDatabase> | undefined;
function openLibrary() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("english-sticker-library", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("이미지 보관함을 열 수 없습니다. 브라우저 저장 공간 설정을 확인해 주세요."));
  });
  return database;
}
async function readImages() {
  const db = await openLibrary();
  return new Promise<StoredImage[]>((resolve, reject) => {
    const request = db.transaction("images").objectStore("images").getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("저장한 이미지를 읽을 수 없습니다."));
  });
}
async function writeImage(value: StoredImage | string) {
  const db = await openLibrary();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("images", "readwrite");
    const store = transaction.objectStore("images");
    if (typeof value === "string") store.delete(value); else store.put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = transaction.onabort = () => reject(new Error("이미지를 저장하지 못했습니다. 브라우저 저장 공간이 부족할 수 있습니다."));
  });
}
export async function importSticker(file: File) {
  if (!["image/png", "image/jpeg", "image/webp", "image/avif", "image/gif"].includes(file.type)) throw new Error(`${file.name}: PNG·JPG·WebP·AVIF·GIF 이미지를 선택해 주세요.`);
  if (file.size > 15 * 1024 * 1024) throw new Error(`${file.name}: 파일 한 장은 15MB 이하여야 합니다.`);
  const hash = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  const id = `local:${Array.from(new Uint8Array(hash)).map(n => n.toString(16).padStart(2,"0")).join("")}`;
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); } catch { throw new Error(`${file.name}: 이미지 내용을 읽을 수 없습니다.`); }
  try {
    const ratio = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이미지를 처리할 수 없습니다.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error("이미지를 처리하지 못했습니다.")), "image/webp", 0.9));
    await writeImage({ id, name: file.name.replace(/\.[^.]+$/, ""), blob });
    return id;
  } finally { bitmap.close(); }
}
export async function deleteStickerImage(id: string) { await writeImage(id); window.dispatchEvent(new Event(EVENT)); }
export function notifyLibraryChanged() { window.dispatchEvent(new Event(EVENT)); }

/** 이미지는 원격 DB가 아닌 기기의 IndexedDB에 저장합니다. URL은 렌더 수명에 맞춰 해제합니다. */
export function useStickerLibrary() {
  const [revision, reload] = useReducer(n => n + 1, 0);
  const [snapshot, setSnapshot] = useState<{ revision: number; images: StickerImage[]; error?: string } | null>(null);
  useEffect(() => { window.addEventListener(EVENT, reload); return () => window.removeEventListener(EVENT, reload); }, []);
  useEffect(() => {
    let active = true; const urls: string[] = []; const controller = new AbortController();
    void (async () => {
      const local = await readImages().then(images => ({ images, error: undefined })).catch((error: Error) => ({ images: [] as StoredImage[], error: error.message }));
      const catalog = await fetch("/stickers/catalog.json", { signal: controller.signal }).then(res => res.ok ? res.json() : []).catch(() => []);
      if (!active) return;
      const packaged: StickerImage[] = Array.isArray(catalog) ? catalog.filter((entry): entry is { id: string; name: string; src: string } => Boolean(entry && typeof entry.id === "string" && typeof entry.name === "string" && typeof entry.src === "string" && /^\/stickers\/[a-zA-Z0-9%._/-]+$/.test(entry.src) && !entry.src.includes(".."))).map(entry => ({ ...entry, local: false })) : [];
      const images = local.images.map(entry => { const src = URL.createObjectURL(entry.blob); urls.push(src); return { id: entry.id, name: entry.name, src, local: true }; });
      setSnapshot({ revision, images: [...packaged, ...images], error: local.error });
    })();
    return () => { active = false; controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)); };
  }, [revision]);
  return { images: snapshot?.images ?? [], loading: snapshot?.revision !== revision, error: snapshot?.error };
}
