/** Supabase 환경 변수 읽기 + 플레이스홀더 감지
 *
 *  .env.local 이 안내 문구 그대로 남아 있으면 createBrowserClient 가 엉뚱한
 *  주소로 요청을 보내고, 화면에는 원인을 알 수 없는 "Failed to fetch" 만 뜹니다.
 *  그래서 클라이언트를 만들기 전에 값이 실제로 채워졌는지 먼저 확인합니다.
 */

const URL_VALUE = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY_VALUE = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 값이 비었거나 안내 문구(한글이 섞인 플레이스홀더)인지 판별합니다.
 *  Supabase URL과 키는 전부 ASCII이므로, 한글이 있으면 플레이스홀더입니다. */
function looksUnfilled(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return !/^[\x20-\x7e]+$/.test(trimmed);
}

export const supabaseConfigured =
  !looksUnfilled(URL_VALUE) && !looksUnfilled(KEY_VALUE);

/** 로그인 UI에 그대로 보여 줄 안내 문구 (설정이 끝났으면 null) */
export const supabaseConfigHint: string | null = supabaseConfigured
  ? null
  : "프론트엔드 .env.local 의 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 아직 채워지지 않았습니다. Supabase 대시보드 > Project Settings > API Keys 의 publishable 키를 넣고 개발 서버를 다시 시작해 주세요.";

/** 설정이 끝났다는 전제에서 값을 꺼냅니다. 호출 전에 supabaseConfigured 를 확인하세요. */
export function requireSupabaseEnv(): { url: string; anonKey: string } {
  if (!supabaseConfigured) {
    throw new Error(supabaseConfigHint ?? "Supabase 환경 변수가 설정되지 않았습니다.");
  }
  return { url: URL_VALUE!.trim(), anonKey: KEY_VALUE!.trim() };
}
