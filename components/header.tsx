import { getMenuData } from "@/lib/menu-data";
import { getSessionProfile } from "@/lib/auth";
import { avatarUrl } from "@/lib/avatar";
import HeaderNav from "./header-nav";

// 공통 헤더 — 메뉴 데이터(공개, 10분 캐시)와 세션 프로필을 서버에서 읽어 HeaderNav(클라)에 넘긴다.
// 상시 서버 렌더링이라 layout에서 세션(쿠키)을 읽어도 되고, 로그인 상태가 첫 페인트부터 반영된다.
export default async function Header() {
  const [{ boards, staticPages }, p] = await Promise.all([getMenuData(), getSessionProfile()]);
  const profile = p
    ? { nickname: p.nickname, role: p.role, avatarUrl: await avatarUrl(p.avatar_path) }
    : null;
  return <HeaderNav boards={boards} staticPages={staticPages} profile={profile} />;
}
