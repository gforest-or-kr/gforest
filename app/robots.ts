import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 공개 페이지는 크롤 허용, 비공개·액션 경로는 차단. 회원 게시판 '글'은 경로가 공개글과 같아
// robots로 구분할 수 없으므로, 각 페이지의 generateMetadata가 noindex로 누설을 막는다(GFM-58).
// 정식 도메인이 아닌 환경(SITE_INDEXABLE != "true": dev·컷오버 전 prod)은 전부 차단 — proxy.ts 의 X-Robots-Tag 와 짝.
export const dynamic = "force-dynamic"; // 환경변수를 요청 시점에 읽는다(빌드 시점 고정 방지)

export default function robots(): MetadataRoute.Robots {
  if (process.env.SITE_INDEXABLE !== "true") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/me",
        "/login",
        "/signup",
        "/reset-password",
        "/auth/",
        "/dl/", // 첨부 다운로드 프록시
        "/boards/*/write",
        "/boards/*/*/edit",
        "/preview", // 디자인 시안 프로토타입 (비공개 미리보기, GFM-63)
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
