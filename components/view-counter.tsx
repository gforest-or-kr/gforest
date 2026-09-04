"use client";

import { useEffect } from "react";
import { incrementViewCount } from "@/app/(site)/boards/[slug]/actions";

// 조회수 — 표시값은 서버 렌더값+1(근사), 실제 증가는 마운트 시 서버 액션(incrementViewCount →
// increment_view_count, security definer)으로 한다. 조회수는 정확성보다 가벼움이 우선 —
// 클라 차단 시 미집계 허용.
export default function ViewCounter({ postId, baseCount }: { postId: string; baseCount: number }) {
  useEffect(() => {
    void incrementViewCount(postId);
  }, [postId]);
  return <>{baseCount + 1}</>;
}
