import type { Metadata } from "next";
// 폰트는 시스템 폰트 스택 사용 (globals.css --font-sans). 한글 웹폰트(Pretendard ~283KB)
// 전송이 모바일 저속망에서 최대 병목이라 제거 — 전송 0, OS 기본 한글 폰트로 렌더 (#25)
import "./globals.css";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "푸른숲발도르프학교",
    template: "%s | 푸른숲발도르프학교",
  },
  description: "푸른숲발도르프학교 — 학부모조합이 함께 만드는 학교",
};

// 루트 레이아웃은 html/body 골격만. 공통 셸(Header/Footer)은 app/(site)/layout.tsx로,
// 시안 A 프로토타입은 app/(proto)/layout.tsx로 — 라우트 그룹별 셸 분리 (GFM-63).
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
