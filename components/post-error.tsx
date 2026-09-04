"use client";

import { useSearchParams } from "next/navigation";

// deletePost 실패 시 ?error= 메시지 표시 — page가 searchParams를 안 읽어 태그 캐시(unstable_cache)를 그대로 쓰도록
// 에러 표시만 클라로 분리한다.
export default function PostError() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <p className="mt-4 rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</p>
  );
}
