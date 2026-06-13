"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// 조회수 — 정적(ISR) 페이지의 부수효과(증가)를 클라이언트로 분리한다. 표시값은 서버
// 캐시값+1(근사), 실제 증가는 마운트 시 RPC로 한다. increment_view_count는 security
// definer라 anon도 실행 가능. (조회수는 정확성보다 가벼움이 우선 — 클라 차단 시 미집계 허용)
export default function ViewCounter({ postId, baseCount }: { postId: string; baseCount: number }) {
  useEffect(() => {
    const supabase = createClient();
    supabase.rpc("increment_view_count", { p_post_id: postId });
  }, [postId]);
  return <>{baseCount + 1}</>;
}
