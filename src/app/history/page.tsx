import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { GlassWindow } from "@/components/GlassWindow";
import { getServerAuthState } from "@/lib/supabase/server";
import { HistoryDashboard } from "./HistoryDashboard";
import { SignInNotice } from "./SignInNotice";

export const metadata = {
  title: "학습 기록 · 토플 고득점 도우미",
};

/** 학습 기록 대시보드.
 *
 *  로그인 판정을 서버에서 먼저 합니다. 클라이언트에서만 판정하면 로그인한
 *  사용자에게도 "로그인이 필요합니다" 안내가 한 번 깜빡이고 지나갑니다.
 *
 *  getServerAuthState() 는 cookies() 를 읽으므로 반드시 <Suspense> 안에 있어야
 *  합니다. next.config.ts 의 cacheComponents 가 켜져 있으면 경계 밖에서
 *  cookies() 를 읽는 것은 빌드 오류입니다.
 */
export default function HistoryPage() {
  return (
    <main className="grain mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        홈으로
      </Link>

      <Suspense fallback={<HistorySkeleton />}>
        <HistoryGate />
      </Suspense>
    </main>
  );
}

async function HistoryGate() {
  const auth = await getServerAuthState();

  if (auth.status === "signed-in") {
    return <HistoryDashboard />;
  }

  // 백엔드의 401 을 그대로 노출하지 않고, 원인에 맞는 안내를 보여 줍니다.
  return <SignInNotice reason={auth.status} />;
}

function HistorySkeleton() {
  return (
    <GlassWindow title="학습 기록" toolbar={<AuthStatus />}>
      <div className="flex items-center gap-2.5 py-8 text-sm text-white/45">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        세션을 확인하는 중...
      </div>
    </GlassWindow>
  );
}
