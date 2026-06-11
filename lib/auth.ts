import { createClient } from "./supabase/server";
import type { Database } from "./supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// 현재 로그인 사용자의 프로필(역할 포함). 비로그인 시 null.
export async function getSessionProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  return data;
}
