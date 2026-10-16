import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv, supabaseConfigured } from "./env";

/** 서버 컴포넌트용 Supabase 클라이언트.
 *
 *  요청마다 "새로" 만들어야 합니다. 인스턴스를 재사용하면 다른 사용자의 쿠키로
 *  갱신된 세션이 섞일 수 있습니다.
 *
 *  서버 컴포넌트에서는 쿠키를 쓸 수 없으므로(HTTP 가 스트리밍을 시작한 뒤에는
 *  Set-Cookie 를 보낼 수 없습니다) setAll 은 조용히 넘깁니다. 토큰 갱신을 실제로
 *  쿠키에 기록하는 일은 proxy.ts 가 담당합니다.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const { url, anonKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // 서버 컴포넌트에서는 쓰기가 불가능합니다. proxy.ts 가 갱신을 맡습니다.
      },
    },
  });
}

/** 서버에서 본 로그인 상태. access_token 은 클라이언트로 내리지 않습니다. */
export type ServerAuthState =
  | { status: "unconfigured" }
  | { status: "signed-out" }
  | { status: "signed-in"; email: string | null; userId: string };

/** 쿠키의 세션을 검증해 로그인 상태를 돌려줍니다.
 *
 *  getUser() 를 씁니다. getSession() 은 쿠키 내용을 그대로 신뢰하지만,
 *  getUser() 는 Supabase Auth 서버에 토큰을 검증받으므로 서버 측 판단에 안전합니다.
 *
 *  주의: cookies() 를 읽으므로 이 함수를 호출하는 컴포넌트는 반드시 <Suspense>
 *  경계 안에 있어야 합니다. cacheComponents 가 켜져 있으면(next.config.ts)
 *  경계 밖에서 cookies() 를 읽는 것은 빌드 오류입니다.
 */
export async function getServerAuthState(): Promise<ServerAuthState> {
  if (!supabaseConfigured) return { status: "unconfigured" };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return { status: "signed-out" };
  return {
    status: "signed-in",
    email: data.user.email ?? null,
    userId: data.user.id,
  };
}
