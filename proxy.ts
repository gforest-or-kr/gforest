import { NextResponse } from "next/server";

// 정식 도메인(컷오버 후 gforest.or.kr)이 아닌 환경 — dev, 컷오버 전 prod.gforest.or.kr, 로컬 — 은 검색엔진에
// 잡히면 안 된다(중복 콘텐츠·미완성 화면 노출). SITE_INDEXABLE=true 인 환경만 색인을 허용한다.
// robots.txt(app/robots.ts)와 짝. 값은 tfvars 의 environment 에서 온다.
export function proxy() {
  const res = NextResponse.next();
  if (process.env.SITE_INDEXABLE !== "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
