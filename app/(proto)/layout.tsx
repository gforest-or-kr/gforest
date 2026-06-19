import type { Metadata } from "next";

// 디자인 시안 프로토타입 전용 셸 (GFM-63). 운영 본사이트와 완전히 분리된 그룹이라
// 글로벌 Header/Footer가 없고, 시안 A 재현을 위해 Pretendard를 **이 그룹에서만** 로드한다.
// (운영 본사이트는 globals.css의 시스템 폰트 스택 유지 — 원칙 #25/#8, egress 영향 없음)
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const PRETENDARD_CDN =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export default function ProtoLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {/* Next가 head로 호이스트. 프리뷰 경로에서만 적용 */}
      <link rel="stylesheet" href={PRETENDARD_CDN} />
      <div
        style={{
          fontFamily:
            '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", sans-serif',
        }}
      >
        {children}
      </div>
    </>
  );
}
