import type { Metadata } from "next";
import "./survey.css";

// 포털(/portal/**, /portal-admin/**) 셸 — 설문 등 사이트 바깥에 두는 화면. 사이트 Header/Footer 없이 답안지 스타일(survey.css)만 쓴다.
// portal.<도메인> 호스트는 proxy.ts 가 모든 경로를 /portal 아래로 rewrite 하므로 이 그룹의 /portal/** 만 보인다.
// survey.css 의 모든 선택자는 .svy 접두라, 라우트 이동 후 스타일시트가 남아도 사이트에 새지 않는다.
// 웹폰트는 로드하지 않는다(시스템 고딕 스택, 원칙 #25). 페이지에서 robots 를 다시 정의하지 말 것.
export const metadata: Metadata = {
  title: "포털",
  robots: { index: false, follow: false },
};

export default function PortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="svy">{children}</div>;
}
