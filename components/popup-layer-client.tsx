"use client";

import nextDynamic from "next/dynamic";

// PopupLayer를 초기 클라이언트 청크에서 제외 — 팝업은 첫 화면 렌더에 불필요(노출 조건
// 충족 시에만 마운트). ssr:false는 서버 컴포넌트(next/dynamic)에서 금지라 클라이언트 경계에서 래핑 (#20)
const PopupLayer = nextDynamic(() => import("./popup-layer"), { ssr: false });

export default PopupLayer;
