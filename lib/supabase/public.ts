import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// 공개 데이터 전용 클라이언트 (쿠키 무관) — unstable_cache 안에서 사용 가능
export function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}
