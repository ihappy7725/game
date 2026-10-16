"use client";

import { useId, useRef, useState } from "react";
import { ApiError, fetchInventory, placeInventoryItem, type InventoryItem } from "@/lib/api";
import { gameError, tokenForGameUser } from "@/lib/game-state";
import { useGameResource } from "./useGameResource";
import { actionClass, RARITY_NAMES } from "./dorm-ui";

type Selection = { id: string; x: number; y: number; placed: boolean };
export function DormRoom({ userId, revision }: { userId: string; revision: number }) {
  const inventory = useGameResource(userId, fetchInventory, revision);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [message, setMessage] = useState("");
  const fieldId = useId();
  const selected = inventory.data?.items.find((item) => item.item_id === selection?.id);
  function select(item: InventoryItem) {
    if (locked.current) return;
    setSelection({ id: item.item_id, x: item.placed_x ?? 50, y: item.placed_y ?? 50, placed: item.placed });
    setMessage("");
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
    <section aria-label="나의 책상" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">나의 책상</h3><button type="button" onClick={inventory.reload} disabled={saving || inventory.loading} className={actionClass}>보유 아이템 새로고침</button></div>
      <p className="text-xs leading-relaxed text-white/60">보유 아이템을 선택하고 가로·세로 위치를 조절한 뒤 배치를 저장하세요.</p>
      <div aria-label="책상 배치 미리보기" className="relative h-64 overflow-hidden rounded-2xl border border-[#bd9060]/40 bg-gradient-to-b from-[#32251d] via-[#684427] to-[#3b281b]">
        <span aria-hidden className="absolute inset-x-0 bottom-7 h-px bg-[#e8c99c]/25" />
        <div className="absolute inset-7">
          {inventory.data?.items.map((item) => {
            const preview = selection?.id === item.item_id ? selection : null;
            if (!(preview?.placed ?? item.placed)) return null;
            return <button key={item.item_id} type="button" aria-label={`${item.name} 위치 편집`} title={item.name} disabled={saving}
              onClick={() => select(item)} className="absolute grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-white/20 bg-black/40 text-3xl focus-visible:outline-2 focus-visible:outline-white"
              style={{ left: `${preview?.x ?? item.placed_x ?? 50}%`, top: `${preview?.y ?? item.placed_y ?? 50}%` }}>{item.emoji}</button>;
          })}
        </div>
      </div>
      {inventory.loading ? <p role="status" className="text-sm text-white/65">보유 아이템을 불러오는 중...</p> : inventory.error ? <p role="alert" className="text-sm text-[#ffb4b0]">{inventory.error}</p>
        : inventory.data?.items.length === 0 ? <p className="text-sm text-white/65">아직 보유한 아이템이 없습니다. 아이템 뽑기에서 책상을 채워 보세요.</p> : null}
      {!inventory.error && inventory.data ? <ul className="grid gap-2 sm:grid-cols-2" aria-label="보유 아이템">
        {inventory.data.items.map((item) => <li key={item.item_id}><button type="button" onClick={() => select(item)} disabled={saving || inventory.loading} aria-pressed={selection?.id === item.item_id}
          className={`${actionClass} flex w-full items-center gap-3 text-left ${selection?.id === item.item_id ? "bg-white/15" : ""}`}>
          <span aria-hidden className="text-2xl">{item.emoji}</span><span><span className="block font-medium">{item.name} · {item.quantity}개</span><span className="block text-xs text-white/55">{RARITY_NAMES[item.rarity] ?? "아이템"}{item.placed ? " · 배치됨" : ""}</span></span>
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
