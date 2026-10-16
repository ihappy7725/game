"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseConfigured } from "@/lib/supabase/env";
import { tryGetSupabaseBrowserClient } from "@/lib/supabase/client";

export type AuthState =
  /** 쿠키에서 세션을 복원하는 중 */
  | { status: "loading" }
  /** .env.local 이 아직 비어 있어 로그인 자체가 불가능 */
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string | null; userId: string };

/** 브라우저에서 본 로그인 상태와 access token 접근자.
 *
 *  access token 은 state 에 담아 두지 않습니다. 1시간이면 만료되므로 들고 있던
 *  값을 재사용하면 백엔드가 401 을 돌려줍니다. 필요할 때마다 getAccessToken() 을
 *  호출하면 supabase-js 가 만료된 토큰을 알아서 갱신해 줍니다.
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>(
    supabaseConfigured ? { status: "loading" } : { status: "unconfigured" },
  );

  useEffect(() => {
    const supabase = tryGetSupabaseBrowserClient();
    // 설정이 없으면 useState 초기값이 이미 "unconfigured" 이므로 그대로 둡니다.
    if (!supabase) return;

    let active = true;

    // 첫 렌더에서 쿠키의 세션을 한 번 확인합니다.
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      const user = data.session?.user;
      setState(
        user
          ? { status: "signed-in", email: user.email ?? null, userId: user.id }
          : { status: "signed-out" },
      );
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!active) return;
        const user = session?.user;
        setState(
          user
            ? { status: "signed-in", email: user.email ?? null, userId: user.id }
            : { status: "signed-out" },
        );

        // 서버 컴포넌트(/history 의 로그인 판정)가 새 쿠키를 다시 읽도록 합니다.
        // INITIAL_SESSION 과 TOKEN_REFRESHED 에서는 새로고침하지 않습니다.
        // 전자는 첫 렌더와 겹쳐 불필요하고, 후자는 1시간마다 조용히 일어나므로
        // 화면을 다시 그릴 이유가 없습니다.
        if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
          router.refresh();
        }
      },
    );

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [router]);

  /** 백엔드 호출에 쓸 access token. 로그인 상태가 아니면 null. */
  const getAccessToken = useCallback(async (): Promise<string | null> => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return null;
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = tryGetSupabaseBrowserClient();
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  return { state, getAccessToken, signOut };
}
