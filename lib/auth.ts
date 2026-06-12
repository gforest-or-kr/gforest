import { createClient } from "./supabase/server";
import type { Database } from "./supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// 현재 로그인 사용자의 프로필(역할 포함). 비로그인 시 null.
// getClaims(): ES256 JWT를 JWKS로 로컬 검증 — getUser()의 Auth 서버 왕복 제거
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  return profile;
}
