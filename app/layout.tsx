import type { Metadata } from "next";
import { Suspense } from "react";
// Pretendard self-host — 외부 CDN 렌더 블로킹 제거, Next가 동일 오리진 엣지에서 서빙 (GFM-30)
// 단일 파일 변형 — dynamic-subset(한글 unicode-range별 다수 서브셋 woff2 동시 다운로드)을
// 단일 woff2 1요청으로 교체해 초기 화면 폰트 요청 수·대역폭 경합을 줄인다. font-display:swap 기본 (#20)
import "pretendard/dist/web/variable/pretendardvariable.css";
import "./globals.css";
import Header from "@/components/header";
import HeaderShell from "@/components/header-shell";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: {
    default: "푸른숲발도르프학교",
    template: "%s | 푸른숲발도르프학교",
  },
  description: "푸른숲발도르프학교 — 학부모조합이 함께 만드는 학교",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {/* 헤더(인증 조회)가 첫 페인트를 막지 않도록 스트리밍 (GFM-29) */}
        <Suspense fallback={<HeaderShell />}>
          <Header />
        </Suspense>
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  );
}
