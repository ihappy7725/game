"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { LogIn, LogOut } from "lucide-react";
import { PlayerAvatar } from "./PlayerProfile";
import { supabaseConfigHint } from "@/lib/supabase/env";
import { useAuth } from "@/lib/useAuth";

/** GlassWindow 타이틀바(toolbar 슬롯)에 들어가는 로그인 상태 표시.
 *  BackendStatus 와 나란히 놓이므로 같은 크기·색 체계를 씁니다. */
export function AuthStatus() {
  const { state, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    try {
      await signOut();
      // 로그인이 필요한 화면에 머물러 있었다면 홈으로 돌려보냅니다.
      if (pathname.startsWith("/history")) router.push("/");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") {
    return <span className="text-xs text-white/35">세션 확인 중</span>;
  }

  if (state.status === "unconfigured") {
    return (
      <span
        className="text-xs text-signal-400/80"
        title={supabaseConfigHint ?? undefined}
      >
        Supabase 미설정
      </span>
    );
  }

  if (state.status === "signed-out") {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/70 transition-colors hover:border-accent-400/50 hover:text-white"
      >
        <LogIn className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        로그인
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Link href="/profile" aria-label="프로필 설정"
        className="flex max-w-[6rem] items-center gap-1.5 text-xs text-white/50 lg:max-w-[11rem]"
        title="닉네임과 캐릭터 설정"
      >
        <PlayerAvatar id={state.avatarId}/>
        <span className="truncate">{state.nickname ?? "프로필 설정"}</span>
      </Link>
      <button
        type="button"
        onClick={handleSignOut}
        disabled={busy}
        className="flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-xs text-white/60 transition-colors hover:border-white/30 hover:text-white disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        {busy ? "처리 중" : "로그아웃"}
      </button>
    </div>
  );
}
