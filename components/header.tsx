import { getSessionProfile } from "@/lib/auth";
import { getMenuData } from "@/lib/menu-data";
import { buildMenu } from "@/lib/menu";
import HeaderNav from "./header-nav";

// 공통 헤더 (SCR-000) — 메뉴는 10분 캐시, 프로필만 요청별 조회 (GFM-29)
export default async function Header() {
  const [profile, { boards, staticPages }] = await Promise.all([
    getSessionProfile(),
    getMenuData(),
  ]);

  const menu = buildMenu(boards, staticPages, profile?.role ?? null);

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
