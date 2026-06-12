import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import type { Database } from "./supabase/types";

// 공개 데이터 전용 클라이언트 (쿠키 무관) — unstable_cache 안에서 사용 가능
function publicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
}

// GNB 메뉴 데이터 — 게시판 구성은 드물게 바뀌므로 10분 캐시 (매 요청 쿼리 2개 제거)
export const getMenuData = unstable_cache(
  async () => {
    const supabase = publicClient();
    const [{ data: boards }, { data: staticPages }] = await Promise.all([
      supabase
        .from("boards")
        .select("slug, name, menu_group, sort_order, read_roles, board_type")
        .eq("is_active", true),
      supabase.from("static_pages").select("slug, title, menu_group, sort_order"),
    ]);
    return { boards: boards ?? [], staticPages: staticPages ?? [] };
  },
  ["menu-data"],
  { revalidate: 600, tags: ["menu"] },
);
