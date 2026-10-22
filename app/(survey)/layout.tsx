import type { Metadata } from "next";
import "./survey.css";

// 이해관계자 웹 질의서 전용 셸. 사이트 Header/Footer 없이 답안지 스타일(survey.css)만 쓴다.
// survey.css 의 모든 선택자는 .svy 접두라, 라우트 이동 후 스타일시트가 남아도 사이트에 새지 않는다.
// 웹폰트는 로드하지 않는다(시스템 고딕 스택, 원칙 #25). 페이지에서 robots 를 다시 정의하지 말 것.
export const metadata: Metadata = {
  title: "새 홈페이지 이해관계자 의견 조사",
  robots: { index: false, follow: false },
};

export default function SurveyLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <div className="svy">{children}</div>;
}
