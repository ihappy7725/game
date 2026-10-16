"use client";

import { useId, useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { ApiError, fetchInventory, placeInventoryItem, type InventoryItem } from "@/lib/api";
import { gameError, tokenForGameUser } from "@/lib/game-state";
import { useGameResource } from "./useGameResource";
import { actionClass, RARITY_NAMES } from "./dorm-ui";
import { DeskItemArt } from "./DeskItemArt";

type Selection = { id: string; x: number; y: number; placed: boolean };
export function DormRoom({ userId, revision }: { userId: string; revision: number }) {
  const inventory = useGameResource(userId, fetchInventory, revision);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState("");
  const fieldId = useId();
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointer: number; id: string; offsetX: number; offsetY: number; start: Selection } | null>(null);
  const selected = inventory.data?.items.find((item) => item.item_id === selection?.id);
  function select(item: InventoryItem) {
    if (locked.current) return;
    setSelection(current => current?.id === item.item_id ? current : { id: item.item_id, x: item.placed_x ?? 50, y: item.placed_y ?? 50, placed: item.placed });
    setMessage("");
  }
  const clamp = (n: number) => Math.round(Math.max(0, Math.min(100, n)));
  function beginDrag(event: PointerEvent<HTMLButtonElement>, item: InventoryItem) {
    if (locked.current || inventory.loading || inventory.error || !area.current) return;
    const current = selection?.id === item.item_id ? selection : { id: item.item_id, x: item.placed_x ?? 50, y: item.placed_y ?? 50, placed: true };
    const rect = area.current.getBoundingClientRect();
    drag.current = { pointer: event.pointerId, id: item.item_id, offsetX: event.clientX - rect.left - current.x / 100 * rect.width, offsetY: event.clientY - rect.top - current.y / 100 * rect.height, start: current };
    setSelection(current); setMessage(""); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const current = drag.current; const rect = area.current?.getBoundingClientRect();
    if (!current || current.pointer !== event.pointerId || !rect || locked.current) return;
    const x = clamp((event.clientX - rect.left - current.offsetX) / rect.width * 100);
    const y = clamp((event.clientY - rect.top - current.offsetY) / rect.height * 100);
    setSelection({ id: current.id, x, y, placed: true });
  }
  function moveKey(event: KeyboardEvent<HTMLButtonElement>, item: InventoryItem) {
    if (!event.key.startsWith("Arrow") || locked.current || inventory.loading || inventory.error) return;
    event.preventDefault(); const amount = event.shiftKey ? 10 : 2;
    setSelection(current => {
      const next = current?.id === item.item_id ? current : { id: item.item_id, x: item.placed_x ?? 50, y: item.placed_y ?? 50, placed: true };
      return { ...next, x: clamp(next.x + (event.key === "ArrowLeft" ? -amount : event.key === "ArrowRight" ? amount : 0)), y: clamp(next.y + (event.key === "ArrowUp" ? -amount : event.key === "ArrowDown" ? amount : 0)) };
    });
  }
  async function save() {
    if (!selection || !selected || locked.current || inventory.loading) return;
    locked.current = true;
    setSaving(true);
    setMessage("");
    try {
      const token = await tokenForGameUser(userId);
      const item = await placeInventoryItem(token, { item_id: selection.id, placed: selection.placed, x: selection.placed ? selection.x : null, y: selection.placed ? selection.y : null });
      setMessage(item.placed ? "책상 배치를 저장했습니다." : "책상에서 아이템을 치웠습니다.");
      setSelection({ id: item.item_id, x: item.placed_x ?? 50, y: item.placed_y ?? 50, placed: item.placed });
      inventory.reload();
      window.dispatchEvent(new Event("toefl-progress-refresh"));
    } catch (error) {
      const detail = error instanceof ApiError && error.status === 404 ? error.message : gameError(error);
      setMessage(`${detail} 저장된 위치는 새로고침으로 확인할 수 있습니다.`);
    }
    finally { locked.current = false; setSaving(false); }
  }
  return (
    <section aria-label="나의 책상" className="desk-room space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">나의 책상</h3><button type="button" onClick={inventory.reload} disabled={saving || inventory.loading} className={actionClass}>보유 아이템 새로고침</button></div>
      <p className="desk-instructions">보유 아이템을 하나씩 선택해 놓고, 직접 끌거나 방향키로 움직인 뒤 <b>배치 저장</b>을 눌러주세요. 같은 종류는 하나씩 배치하며 중복 수량은 보관합니다.</p>
      <div aria-label="책상 배치 미리보기" className="desk-scene">
        <div className="desk-window" aria-hidden="true"><i/><i/></div><div className="desk-wall-light" aria-hidden="true"/><div className="desk-surface" aria-hidden="true"/><div className="desk-front" aria-hidden="true"/>
        <span className="desk-scene-title">나의 작은 캠퍼스</span>
        <div className="desk-placement-area" ref={area} aria-label="책상 배치 영역">
          {inventory.data?.items.map((item) => {
            const preview = selection?.id === item.item_id ? selection : null;
            if (!(preview?.placed ?? item.placed)) return null;
            const x = preview?.x ?? item.placed_x ?? 50; const y = preview?.y ?? item.placed_y ?? 50;
            return <button key={item.item_id} type="button" aria-label={`${item.name} 위치 편집`} aria-pressed={selection?.id === item.item_id} aria-describedby={`${fieldId}-help`} title={item.name} disabled={saving || inventory.loading || Boolean(inventory.error)}
              onClick={() => select(item)} onPointerDown={event => beginDrag(event, item)} onPointerMove={moveDrag} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { if (drag.current) setSelection(drag.current.start); drag.current = null; }} onKeyDown={event => moveKey(event, item)} className="desk-placed-item"
              style={{ left: `${x}%`, top: `${y}%`, zIndex: Math.round(y) + 1 }}><DeskItemArt id={item.item_id} emoji={item.emoji}/><span>{item.name}</span></button>;
          })}
        </div>
      </div>
      <p id={`${fieldId}-help`} className="desk-key-help">드래그 / 터치 · 방향키 2% 이동 · Shift + 방향키 10% 이동 · 저장 전 위치는 미리보기입니다.</p>
      {inventory.loading ? <p role="status" className="text-sm text-white/65">보유 아이템을 불러오는 중...</p> : inventory.error ? <p role="alert" className="text-sm text-[#ffb4b0]">{inventory.error}</p>
        : inventory.data?.items.length === 0 ? <p className="text-sm text-white/65">아직 보유한 아이템이 없습니다. 아이템 뽑기에서 책상을 채워 보세요.</p> : null}
      {!inventory.error && inventory.data ? <ul className="grid gap-2 sm:grid-cols-2" aria-label="보유 아이템">
        {inventory.data.items.map((item) => <li key={item.item_id}><button type="button" onClick={() => select(item)} disabled={saving || inventory.loading} aria-pressed={selection?.id === item.item_id}
          className={`${actionClass} flex w-full items-center gap-3 text-left ${selection?.id === item.item_id ? "bg-white/15" : ""}`}>
          <span className="desk-inventory-art"><DeskItemArt id={item.item_id} emoji={item.emoji}/></span><span><span className="block font-medium">{item.name} · {item.quantity}개</span><span className="block text-xs text-white/55">{RARITY_NAMES[item.rarity] ?? "아이템"}{item.placed ? " · 배치됨" : " · 보관 중"}</span></span>
        </button></li>)}
      </ul> : null}
      {selected && selection ? <fieldset disabled={saving || inventory.loading} className="space-y-4 rounded-xl border border-white/15 bg-black/20 p-4">
        <legend className="px-2 text-sm font-medium">{selected.name} 배치 편집</legend>
        {selected.description ? <p className="text-xs text-white/60">{selected.description}</p> : null}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selection.placed} onChange={(e) => setSelection({ ...selection, placed: e.target.checked })} />책상에 배치</label>
        {(["x", "y"] as const).map((axis) => <div key={axis}>
          <label htmlFor={`${fieldId}-${axis}`} className="mb-2 block text-xs">{axis === "x" ? "가로" : "세로"} 위치 · {selection[axis]}%</label>
          <input id={`${fieldId}-${axis}`} type="range" min={0} max={100} step={1} value={selection[axis]} onChange={(e) => setSelection({ ...selection, [axis]: Number(e.target.value) })} className="w-full" />
        </div>)}
        <button type="button" className={actionClass} onClick={() => void save()}>{saving ? "배치 저장 중..." : "배치 저장"}</button>
      </fieldset> : null}
      {message ? <p role="status" className="text-sm text-white/75">{message}</p> : null}
    </section>
  );
}
