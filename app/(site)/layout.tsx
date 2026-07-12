import { Suspense } from "react";
import Header from "@/components/header";
import HeaderShell from "@/components/header-shell";
import Footer from "@/components/footer";

// 운영 본사이트 공통 셸 — 기존 루트 레이아웃에서 분리(GFM-63). 라우트 그룹 (site)는 URL에
// 영향을 주지 않으므로 기존 경로(/ · /boards · /admin …)와 동작이 100% 동일하다.
const SUPABASE_ORIGIN = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin;

export default function SiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-full flex flex-col">
      {/* Supabase 오리진 preconnect(GFM-67) — 회원 콘텐츠의 첫 클라 fetch가 하이드레이션 뒤에
          시작되므로, 연결 수립(DNS+TCP+TLS ~100–300ms)을 JS 다운로드와 병렬로 미리 끝낸다.
          CORS fetch(crossOrigin)와 <img> 로드(non-CORS)는 커넥션 풀이 달라 두 힌트가 모두 필요. */}
      <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
      <link rel="preconnect" href={SUPABASE_ORIGIN} />
      {/* 헤더(인증 조회)가 첫 페인트를 막지 않도록 스트리밍 (GFM-29) */}
      <Suspense fallback={<HeaderShell />}>
        <Header />
      </Suspense>
      <div className="flex-1">{children}</div>
      <Footer />
    </div>
  );
}
