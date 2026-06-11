import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 이메일 인증·비밀번호 재설정 링크의 코드 교환 콜백
// Supabase 대시보드 Redirect URLs에 {site}/auth/callback 등록 필요 (GFM-5)
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/login`);
}
