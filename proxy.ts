import { NextResponse, type NextRequest } from "next/server";

// 1) 정식 도메인(컷오버 후 gforest.or.kr)이 아닌 환경 — dev, 컷오버 전 prod.gforest.or.kr, 로컬 — 은 검색엔진에
//    잡히면 안 된다(중복 콘텐츠·미완성 화면 노출). SITE_INDEXABLE=true 인 환경만 색인을 허용한다.
//    robots.txt(app/robots.ts)와 짝. 값은 tfvars 의 environment 에서 온다.
// 2) portal.<도메인>(tfvars alias_hosts, 로컬은 portal.localhost) 로 들어온 요청은 경로 앞에 /portal 을 붙여 rewrite 한다.
//    그 호스트에서는 app/(portal)/portal/** 에 파일이 있는 경로만 열리고 나머지(사이트·/portal-admin)는 404 —
//    허용 목록이 아니라 파일 구조가 노출 범위다. 새 화면은 app/(portal)/portal/<종류>/… 에 추가하면 되고 이 파일은 안 고친다.
//    바깥 주소는 그대로(portal.…/survey/x), 안에서만 /portal/survey/x 로 매핑된다. robots.txt 는 rewrite 하지 않는다.

const PORTAL_HOST_PREFIX = "portal.";
const PORTAL_PASSTHROUGH = new Set(["/robots.txt"]);

function isPortalHost(req: NextRequest): boolean {
  const host = (req.headers.get("host") ?? "").split(":")[0].toLowerCase();
  return host.startsWith(PORTAL_HOST_PREFIX);
}

export function proxy(req: NextRequest) {
  let res: NextResponse;
  const { pathname } = req.nextUrl;
  if (isPortalHost(req) && !PORTAL_PASSTHROUGH.has(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/portal" : `/portal${pathname}`;
    res = NextResponse.rewrite(url);
  } else {
    res = NextResponse.next();
  }
  if (process.env.SITE_INDEXABLE !== "true") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
