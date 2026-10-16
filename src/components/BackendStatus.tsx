"use client";

import { useEffect, useState } from "react";
import { checkBackendHealth } from "@/lib/api";

type State = "checking" | "online" | "offline";

const LABEL: Record<State, string> = {
  checking: "서버 확인 중",
  online: "API 연결됨",
  offline: "API 응답 없음",
};

const DOT: Record<State, string> = {
  checking: "bg-white/40",
  online: "bg-[#28c840]",
  offline: "bg-[#ff5f57]",
};

/** 홈 화면 타이틀바의 백엔드 연결 표시등 */
export function BackendStatus() {
  const [state, setState] = useState<State>("checking");

  useEffect(() => {
    const controller = new AbortController();

    checkBackendHealth(controller.signal)
      .then(() => setState("online"))
      .catch((error: unknown) => {
        // 언마운트로 인한 취소는 오류로 표시하지 않습니다.
        if (error instanceof Error && error.name === "AbortError") return;
        setState("offline");
      });

    return () => controller.abort();
  }, []);

  return (
    <span className="flex items-center gap-2 text-xs text-white/50">
      <span className={`h-2 w-2 rounded-full ${DOT[state]}`} aria-hidden />
      {LABEL[state]}
    </span>
  );
}
