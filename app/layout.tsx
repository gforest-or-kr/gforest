import type { Metadata } from "next";
import { Suspense } from "react";
// Pretendard self-host — 외부 CDN 렌더 블로킹 제거, Next가 동일 오리진 엣지에서 서빙 (GFM-30)
// subset 변형 — dynamic-subset(한글 unicode-range별 다수 서브셋 woff2 동시 다운로드)을
// 상용 한글+영문 단일 woff2 1요청으로 교체. 요청 수↓(대역폭 경합 완화)이면서 full 변형(전 글리프
// ~1.2MB)과 달리 바이트가 크게 늘지 않는다. font-display:swap 기본(FOIT 없음) (#20)
import "pretendard/dist/web/variable/pretendardvariable-subset.css";
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
