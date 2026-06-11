import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { buildMenu } from "@/lib/menu";
import HeaderNav from "./header-nav";

// 공통 헤더 (SCR-000) — 메뉴 데이터·프로필을 서버에서 조회해 클라이언트 내비에 전달
export default async function Header() {
  const supabase = await createClient();
  const [profile, { data: boards }, { data: staticPages }] = await Promise.all([
    getSessionProfile(),
    supabase
      .from("boards")
      .select("slug, name, menu_group, sort_order, read_roles, board_type")
      .eq("is_active", true),
    supabase
      .from("static_pages")
      .select("slug, title, menu_group, sort_order"),
  ]);

  const menu = buildMenu(boards ?? [], staticPages ?? [], profile?.role ?? null);

  return (
    <HeaderNav
      menu={menu}
      profile={
        profile
          ? { nickname: profile.nickname, role: profile.role }
          : null
      }
    />
  );
}
