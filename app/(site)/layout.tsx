import { Suspense } from "react";
import Header from "@/components/header";
import HeaderShell from "@/components/header-shell";
import Footer from "@/components/footer";

// 운영 본사이트 공통 셸 — 기존 루트 레이아웃에서 분리(GFM-63). 라우트 그룹 (site)는 URL에
// 영향을 주지 않으므로 기존 경로(/ · /boards · /admin …)와 동작이 100% 동일하다.
export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-col">
      {/* 헤더(인증 조회)가 첫 페인트를 막지 않도록 스트리밍 (GFM-29) */}
      <Suspense fallback={<HeaderShell />}>
        <Header />
      </Suspense>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
