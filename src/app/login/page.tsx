"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, LogIn } from "lucide-react";
import { GlassWindow } from "@/components/GlassWindow";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";
import { supabaseConfigHint } from "@/lib/supabase/env";
import { useAuth } from "@/lib/useAuth";

/* ---------------------------------------------------------------------------
 * 왜 매직링크가 아니라 "이메일 + 비밀번호"인가
 *
 * 매직링크는 메일이 실제로 도착해야 성립합니다. 그런데
 *   1) Supabase 기본 메일 발송기는 테스트 용도라 시간당 몇 통으로 제한되고,
 *   2) 링크를 받은 뒤 코드를 세션으로 바꿔 줄 /auth/callback 라우트 핸들러가 필요하며,
 *   3) 대시보드에 redirect URL 을 따로 허용 등록해야 합니다.
 * 즉 localhost 개발 환경에서 바로 눌러 확인할 수 없는 외부 의존이 셋이나 생깁니다.
 *
 * 비밀번호 방식은 SMTP 설정 없이 그 자리에서 로그인·로그아웃을 끝까지 검증할 수
 * 있어서, 지금 단계(학습 기록 대시보드를 붙이는 일)에 필요한 최소 경로입니다.
 *
 * 다만 Supabase 는 "Confirm email" 이 기본 ON 이라 회원가입 시 확인 메일을
 * 보냅니다. 로컬에서 가입을 바로 끝내려면 대시보드 > Authentication > Sign In /
 * Providers > Email 에서 "Confirm email" 을 끄세요.
 * ------------------------------------------------------------------------- */

import { ProfileFields } from "@/components/PlayerProfile";
import { validNickname } from "@/lib/player-profile";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const { state } = useAuth();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState("campus-01");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // 이미 로그인한 사용자가 이 화면에 들어오면 대시보드로 보냅니다.
  useEffect(() => {
    if (state.status === "signed-in") router.replace("/history");
  }, [state.status, router]);

  const canSubmit =
    state.status !== "unconfigured" &&
    // 세션 복원과 수화가 끝나기 전에 폼을 제출하지 않습니다.
    state.status !== "loading" &&
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === "signin" || validNickname(nickname)) &&
    !isLoading;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return;

    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { nickname: nickname.trim(), avatar_id: avatar } },
        });
        if (signUpError) throw signUpError;

        // Confirm email 이 켜져 있으면 session 이 null 로 돌아옵니다.
        if (!data.session) {
          setNotice(
            "확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 다시 로그인해 주세요. " +
              "로컬에서 바로 쓰려면 Supabase 대시보드에서 'Confirm email' 을 끄면 됩니다.",
          );
          setMode("signin");
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
      }

      // 로그인에 성공하면 학습 기록 대시보드로 이동합니다.
      router.replace("/history");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="grain mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-5 py-12 sm:px-8">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/80"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        홈으로
      </Link>

      <GlassWindow title={mode === "signin" ? "로그인" : "회원가입"}>
        <p className="text-sm leading-relaxed text-white/60">
          로그인하면 채점 결과가 계정에 저장되고, 학습 기록 대시보드에서 점수 추이를
          볼 수 있습니다.
        </p>

        {state.status === "unconfigured" ? (
          <p
            role="alert"
            className="mt-5 rounded-xl border border-signal-400/30 bg-signal-400/10 px-4 py-3 text-[13px] leading-relaxed text-signal-400"
          >
            {supabaseConfigHint}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              이메일
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="glass-soft w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-xs font-medium tracking-wide text-white/50"
            >
              비밀번호 <span className="text-white/30">(6자 이상)</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="glass-soft w-full rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 outline-none"
            />
          </div>

          {mode === "signup" ? <ProfileFields nickname={nickname} avatar={avatar} onNickname={setNickname} onAvatar={setAvatar}/> : null}

          <motion.button
            type="submit"
            disabled={!canSubmit}
            whileHover={canSubmit ? { y: -2 } : undefined}
            whileTap={canSubmit ? { scale: 0.98 } : undefined}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent-500 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition-colors hover:bg-accent-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-white/40 disabled:shadow-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                처리 중...
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" aria-hidden />
                {mode === "signin" ? "로그인" : "회원가입"}
              </>
            )}
          </motion.button>
        </form>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-xl border border-[#ff5f57]/30 bg-[#ff5f57]/10 px-4 py-3 text-sm text-[#ffb4b0]"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="mt-4 rounded-xl border border-accent-400/30 bg-accent-500/10 px-4 py-3 text-[13px] leading-relaxed text-accent-300">
            {notice}
          </p>
        ) : null}

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signin" ? "signup" : "signin");
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-center text-xs text-white/45 transition-colors hover:text-white/70"
        >
          {mode === "signin"
            ? "계정이 없으신가요? 회원가입"
            : "이미 계정이 있으신가요? 로그인"}
        </button>
      </GlassWindow>
    </main>
  );
}

/** Supabase 가 돌려주는 영문 오류를 화면용 한국어 문구로 바꿉니다. */
function translateAuthError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);

  if (/invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (/email not confirmed/i.test(message)) {
    return "이메일 확인이 완료되지 않았습니다. 받은 메일의 링크를 먼저 눌러 주세요.";
  }
  if (/user already registered/i.test(message)) {
    return "이미 가입된 이메일입니다. 로그인을 시도해 주세요.";
  }
  if (/password should be at least/i.test(message)) {
    return "비밀번호는 6자 이상이어야 합니다.";
  }
  if (/invalid api key/i.test(message)) {
    return "Supabase API 키가 올바르지 않습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_ANON_KEY 에 대시보드의 publishable 키를 넣고 개발 서버를 다시 시작해 주세요.";
  }
  if (/failed to fetch|networkerror/i.test(message)) {
    return "Supabase 에 연결할 수 없습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_URL 을 확인해 주세요.";
  }
  return message;
}
