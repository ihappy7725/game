import Link from "next/link";
import { LogIn, Lock, TriangleAlert } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { GlassWindow } from "@/components/GlassWindow";
import { supabaseConfigHint } from "@/lib/supabase/env";

type Props = {
  /** 왜 대시보드를 못 보여 주는지. 백엔드 401 을 그대로 쓰지 않습니다. */
  reason: "signed-out" | "unconfigured";
};

/** 비로그인(또는 Supabase 미설정) 상태의 /history 안내 화면 */
export function SignInNotice({ reason }: Props) {
  if (reason === "unconfigured") {
    return (
      <GlassWindow title="학습 기록" toolbar={<AuthStatus />}>
        <div className="flex items-start gap-4 py-2">
          <span className="glass-soft grid h-10 w-10 shrink-0 place-items-center rounded-xl text-signal-400">
            <TriangleAlert className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold tracking-tight text-white">
              Supabase 설정이 필요합니다
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-white/60">
              {supabaseConfigHint}
            </p>
          </div>
        </div>
      </GlassWindow>
    );
  }

  return (
    <GlassWindow title="학습 기록" toolbar={<AuthStatus />}>
      <div className="flex items-start gap-4">
        <span className="glass-soft grid h-10 w-10 shrink-0 place-items-center rounded-xl text-accent-300">
          <Lock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold tracking-tight text-white">
            로그인하면 학습 기록이 보입니다
          </h3>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">
            제출 기록은 계정에 저장됩니다. 로그인한 뒤 Writing·Speaking 첨삭을
            받으면 섹션별 응시 횟수와 평균·최고 점수, 점수 추세가 이 화면에
            쌓입니다.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent-500 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            로그인 / 회원가입
          </Link>
        </div>
      </div>
    </GlassWindow>
  );
}
