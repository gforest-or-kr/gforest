import { unstable_cache } from "next/cache";
import { publicClient } from "./supabase/public";

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
