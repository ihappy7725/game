"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseEnv, supabaseConfigured } from "./env";

/** 브라우저용 Supabase 클라이언트.
 *
 *  @supabase/ssr 의 createBrowserClient 는 세션을 localStorage 가 아니라 "쿠키"에
 *  저장합니다. 그래야 같은 세션을 서버 컴포넌트(src/lib/supabase/server.ts)와
 *  proxy.ts 에서도 읽을 수 있습니다.
 *
 *  createBrowserClient 는 기본적으로 싱글턴이므로 매번 호출해도 같은 인스턴스가
 *  돌아옵니다. 덕분에 onAuthStateChange 구독이 중복되지 않습니다.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!cached) {
    const { url, anonKey } = requireSupabaseEnv();
    cached = createBrowserClient(url, anonKey);
  }
  return cached;
}

/** 환경 변수가 비어 있으면 클라이언트를 만들지 않고 null 을 돌려줍니다.
 *  로그인 UI 가 크래시 대신 설정 안내를 띄울 수 있게 하기 위한 안전판입니다. */
export function tryGetSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  return getSupabaseBrowserClient();
}
