import { unstable_cache } from "next/cache";
import { withUser, many } from "@/lib/db";
import type { Database } from "@/lib/db/types";

type MenuBoard = Pick<
  Database["public"]["Tables"]["boards"]["Row"],
  "slug" | "name" | "menu_group" | "sort_order" | "read_roles" | "board_type"
>;
type MenuStaticPage = Pick<
  Database["public"]["Tables"]["static_pages"]["Row"],
  "slug" | "title" | "menu_group" | "sort_order"
>;

// GNB 메뉴 데이터 — 게시판 구성은 드물게 바뀌므로 10분 캐시 (매 요청 쿼리 2개 제거).
// anon RLS 컨텍스트(withUser(null))라 세션을 읽지 않아 unstable_cache 안에서 안전하다.
export const getMenuData = unstable_cache(
  async () =>
    withUser(null, async (c) => {
      // read_roles(enum[])는 pg가 원문 '{a,b}'로 돌려주므로 text[]로 캐스팅해 JS 배열로 받는다.
      const boards = await many<MenuBoard>(
        c,
        `select slug, name, menu_group, sort_order, read_roles::text[] as read_roles, board_type
         from boards where is_active = true`,
      );
      const staticPages = await many<MenuStaticPage>(
        c,
        "select slug, title, menu_group, sort_order from static_pages",
      );
      return { boards, staticPages };
    }),
  ["menu-data"],
  { revalidate: 600, tags: ["menu"] },
);
