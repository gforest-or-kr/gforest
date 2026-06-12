import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 미들웨어에서 Auth 세션 토큰을 갱신하고 쿠키를 동기화한다
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Supabase 프로젝트 연결 전(GFM-1)에도 로컬 실행이 가능하도록 스킵
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims(): JWT 로컬 검증(ES256+JWKS 캐시) — 만료 시에만 갱신 네트워크 호출.
  // 매 요청 Auth 서버를 왕복하던 getUser() 대비 ~100ms 절감 (GFM-29)
  await supabase.auth.getClaims();

  return supabaseResponse;
}
