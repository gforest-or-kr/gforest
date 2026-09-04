// 사이트 절대 URL — robots/sitemap/OG에 필요. 도메인 이전(gforest.or.kr) 시 env로 덮어쓴다.
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") || "https://gforest.or.kr";
