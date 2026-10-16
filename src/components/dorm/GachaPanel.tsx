"use client";

import { useId, useRef, useState } from "react";
import { ApiError, drawGacha, type GachaResult } from "@/lib/api";
import { gameError, tokenForGameUser, useGameState } from "@/lib/game-state";
import { actionClass, RARITY_NAMES } from "./dorm-ui";

// 화면의 가격 안내입니다. 차감 금액을 요청에 포함하지 않으며 실제 비용은 서버가 결정합니다.
const DISPLAY_COST = 300;
export function GachaPanel({ userId, onInventoryChanged }: { userId: string; onInventoryChanged: () => void }) {
  const { snapshot, refresh } = useGameState();
  const [count, setCount] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<GachaResult | null>(null);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const fieldId = useId();
  const balance = snapshot?.data?.coin_balance;
  const enough = balance !== undefined && balance >= count * DISPLAY_COST;

  async function draw() {
    if (locked.current || uncertain || !confirming || !enough) return;
    locked.current = true;
    setBusy(true);
    setConfirming(false);
    setResult(null);
    setError("");
    let sent = false;
    try {
      const token = await tokenForGameUser(userId);
      sent = true;
      const drawn = await drawGacha(token, count);
      setResult(drawn);
    } catch (failure) {
      // DB에서 차감 후 응답만 유실됐을 수 있습니다. 이 경우 같은 창에서 재요청하지 않습니다.
      const rejected = failure instanceof ApiError && [400, 401, 403, 404, 409, 422, 503].includes(failure.status);
      if (sent && !rejected) {
        setUncertain(true);
        setError("뽑기 처리 여부를 확인할 수 없습니다. 보유 아이템과 잔액을 새로고침해 확인해 주세요. 이 창에서는 뽑기를 다시 요청하지 않습니다.");
      } else setError(gameError(failure));
    } finally {
      locked.current = false;
      setBusy(false);
      onInventoryChanged();
      window.dispatchEvent(new Event("toefl-progress-refresh"));
      refresh();
    }
  }

  return (
    <section aria-label="아이템 뽑기" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-semibold">아이템 뽑기</h3><button type="button" onClick={() => { refresh(); onInventoryChanged();
      window.dispatchEvent(new Event("toefl-progress-refresh")); }} disabled={busy} className={actionClass}>잔액·아이템 새로고침</button></div>
      <p className="text-sm text-white/65">공부와 어휘 게임으로 모은 코인으로 책상 아이템을 뽑아 보세요. 같은 아이템이 나오면 보유 수량이 늘어납니다.</p>
      <div className="space-y-3 rounded-2xl border border-white/15 bg-black/25 p-5">
        <p aria-label="뽑기 보유 코인" className="font-mono text-lg">{balance === undefined ? "잔액 확인 필요" : `보유 ${balance.toLocaleString("ko-KR")} 코인`}</p>
        {snapshot?.error ? <p role="alert" className="text-sm text-[#ffb4b0]">{snapshot.error}</p> : null}
        <label htmlFor={fieldId} className="block text-xs text-white/65">뽑기 횟수</label>
        <select id={fieldId} value={count} disabled={busy || uncertain || confirming} onChange={(e) => setCount(Number(e.target.value))} className="w-full rounded-xl border border-white/20 bg-[#29201b] px-3 py-2 text-sm">
          {[1, 2, 5, 10].map((n) => <option key={n} value={n}>{n}회 · {(n * DISPLAY_COST).toLocaleString("ko-KR")} 코인</option>)}
        </select>
        {balance !== undefined && !enough ? <p className="text-sm text-white/65">선택한 뽑기에 필요한 코인이 부족합니다.</p> : null}
        {!confirming ? <button type="button" className={actionClass} disabled={busy || uncertain || !enough} onClick={() => setConfirming(true)}>{busy ? "아이템을 뽑는 중..." : uncertain ? "결과 확인 필요" : "뽑기 선택"}</button>
          : <div className="space-y-3 rounded-xl border border-[#C9A227]/50 bg-[#C9A227]/10 p-4">
            <p className="text-sm">{count}회 뽑기에 {(count * DISPLAY_COST).toLocaleString("ko-KR")} 코인을 사용합니다.</p>
            <div className="flex flex-wrap gap-2"><button type="button" disabled={busy || !enough} onClick={() => void draw()} className={actionClass}>코인 사용하고 뽑기</button><button type="button" onClick={() => setConfirming(false)} className={actionClass}>취소</button></div>
          </div>}
      </div>
      {error ? <p role="alert" className="rounded-xl border border-[#ff5f57]/30 bg-black/25 p-4 text-sm text-[#ffb4b0]">{error}</p> : null}
      {result ? <section aria-label="뽑기 결과" className="space-y-3 rounded-xl border border-white/15 bg-black/20 p-4">
        <h4 className="font-semibold">새로운 책상 아이템</h4>
        <p role="status" className="text-sm">{result.cost.toLocaleString("ko-KR")}코인 사용 · 남은 코인 {result.coin_balance.toLocaleString("ko-KR")}</p>
        <ul className="grid gap-3 sm:grid-cols-2">{result.items.map((item, index) => <li key={`${item.id}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-4">
          <span aria-hidden className="text-3xl">{item.emoji}</span><p className="mt-2 text-sm font-medium">{item.name}</p><p className="mt-1 text-xs text-white/60">{RARITY_NAMES[item.rarity] ?? "아이템"} · 보유 {item.quantity}개</p>
        </li>)}</ul>
        <p className="text-xs text-white/60">나의 책상에서 아이템을 배치할 수 있습니다.</p>
      </section> : null}
    </section>
  );
}
