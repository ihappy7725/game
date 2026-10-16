import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Supabase 세션 쿠키 갱신 (Next.js 16 에서 middleware 는 proxy 로 이름이 바뀌었습니다)
 *
 *  access token 은 1시간이면 만료됩니다. 서버 컴포넌트는 쿠키를 쓸 수 없으므로,
 *  갱신된 토큰을 실제로 Set-Cookie 로 내려보내는 일은 여기서만 할 수 있습니다.
 *  이 파일이 없으면 서버 쪽 세션이 조용히 만료되어, 브라우저는 로그인 상태인데
 *  /history 의 서버 판정은 로그아웃으로 보이는 어긋난 상태가 됩니다.
 */
export async function proxy(request: NextRequest) {
  // 환경 변수가 비어 있으면(아직 .env.local 미설정) 그냥 통과시킵니다.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey || !/^[\x20-\x7e]+$/.test(url + anonKey)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // 요청 쿠키에도 반영해 두어야 이어지는 렌더가 갱신된 토큰을 봅니다.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        // 인증 쿠키가 실린 응답은 CDN/프록시가 캐시하면 다른 사용자에게
        // 같은 세션이 내려갈 수 있습니다. 라이브러리가 주는 no-store 헤더를 그대로 붙입니다.
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // getUser() 를 호출해야 만료된 토큰의 갱신이 실제로 일어납니다.
  // (getSession() 은 쿠키를 그대로 읽기만 하므로 갱신을 유발하지 않습니다.)
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // 정적 파일과 이미지 최적화 요청에서는 세션을 갱신할 필요가 없습니다.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
