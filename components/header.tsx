import { getMenuData } from "@/lib/menu-data";
import HeaderNav from "./header-nav";

// 공통 헤더 — 메뉴 데이터(공개, 10분 캐시)만 서버에서 가져온다. 개인화(세션 role 기반 메뉴
// 필터·로그인 상태)는 HeaderNav가 클라이언트에서 처리한다. 이렇게 해야 layout이 쿠키를
// 읽지 않아, layout을 포함하는 글 상세 등의 페이지가 ISR(정적 생성)될 수 있다.
export default async function Header() {
  const { boards, staticPages } = await getMenuData();
  return <HeaderNav boards={boards} staticPages={staticPages} />;
}
