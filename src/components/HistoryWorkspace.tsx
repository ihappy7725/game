"use client";

import { HistoryDashboard } from "@/app/history/HistoryDashboard";
import { SignInNotice } from "@/app/history/SignInNotice";
import { EmbeddedPanels } from "@/components/GlassWindow";
import { useAuth } from "@/lib/useAuth";

/** 계정이 바뀌면 이전 계정의 기록과 진행 중인 조회를 함께 버립니다. */
export function HistoryWorkspace({ embedded = false }: { embedded?: boolean }) {
  const { state } = useAuth();
  const content = state.status === "loading"
    ? <p role="status" className="py-8 text-sm text-white/60">세션을 확인하는 중...</p>
    : state.status === "signed-in"
      ? <HistoryDashboard key={state.userId} />
      : <SignInNotice reason={state.status} />;
  return embedded ? <EmbeddedPanels>{content}</EmbeddedPanels> : content;
}
