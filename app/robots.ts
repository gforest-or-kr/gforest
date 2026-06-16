import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 공개 페이지는 크롤 허용, 비공개·액션 경로는 차단. 회원 게시판 '글'은 경로가 공개글과 같아
// robots로 구분할 수 없으므로, 각 페이지의 generateMetadata가 noindex로 누설을 막는다(GFM-58).
export default function robots(): MetadataRoute.Robots {
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
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
