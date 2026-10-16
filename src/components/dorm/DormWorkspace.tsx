"use client";

import { useReducer, useState } from "react";
import Link from "next/link";
import { useGameState } from "@/lib/game-state";
import { DormRoom } from "./DormRoom";
import { GachaPanel } from "./GachaPanel";
import { LeaderboardPanel } from "./LeaderboardPanel";

import { actionClass } from "./dorm-ui";

export function DormWorkspace({ tab, onTabChange }: { tab?: string; onTabChange?: (tab: string) => void }) {
  const { auth } = useGameState();
  if (auth.status === "loading") return <p role="status">세션을 확인하는 중...</p>;
  if (auth.status === "unconfigured") return <p>책상을 꾸미려면 로그인 설정을 확인해 주세요.</p>;
  if (auth.status === "signed-out") return <div className="space-y-4 text-sm"><h3 className="text-lg font-semibold">로그인하면 나만의 책상을 꾸밀 수 있습니다</h3><p className="text-white/65">보유 아이템과 코인, 주간 랭킹은 계정에 연결됩니다.</p><Link href="/login" className="inline-block underline">로그인 / 회원가입</Link></div>;
  // 창 자체를 유지하면서 계정별 본문과 진행 중 조회·선택 상태만 초기화합니다.
  return <AccountDorm key={auth.userId} userId={auth.userId} externalTab={tab} onTabChange={onTabChange} />;
}

function AccountDorm({ userId, externalTab, onTabChange }: { userId: string; externalTab?: string; onTabChange?: (tab: string) => void }) {
  const [localTab, setLocalTab] = useState("room");
  const tab = externalTab ?? localTab;
  const setTab = onTabChange ?? setLocalTab;
  const [inventoryRevision, inventoryChanged] = useReducer((n: number) => n + 1, 0);
  const tabs = [{ id: "room", label: "나의 책상" }, { id: "gacha", label: "아이템 뽑기" }, { id: "ranking", label: "주간 랭킹" }];
  return (
    <div className="space-y-5">
      <nav aria-label="책상과 도전 메뉴" className="flex flex-wrap gap-2">
        {tabs.map((item) => <button type="button" key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`${actionClass} ${tab === item.id ? "bg-white/15" : "text-white/60"}`}>{item.label}</button>)}
      </nav>
      {/* 탭을 바꿔도 뽑기 진행 상태와 편집 중 좌표를 유지합니다. */}
      <div hidden={tab !== "room"}><DormRoom userId={userId} revision={inventoryRevision} /></div>
      <div hidden={tab !== "gacha"}><GachaPanel userId={userId} onInventoryChanged={inventoryChanged} /></div>
      <div hidden={tab !== "ranking"}><LeaderboardPanel userId={userId} /></div>
    </div>
  );
}
