"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// 개인화(글쓰기 권한) UI — 클라이언트에서 세션 role을 확인해 표시한다.
// 이걸 클라로 분리해야 게시판 page가 쿠키를 읽지 않아 정적/ISR + prefetch가 가능해진다.
export default function WriteButton({
  slug,
  writeRoles,
  variant,
}: {
  slug: string;
  writeRoles: string[];
  variant: "header" | "fab";
}) {
  const [canWrite, setCanWrite] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getClaims();
      const uid = data?.claims?.sub;
      if (!uid) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single();
      const role = profile?.role;
      if (active && role && (role === "admin" || writeRoles.includes(role))) {
        setCanWrite(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [writeRoles]);

  if (!canWrite) return null;

  if (variant === "header") {
    return (
      <Link
        href={`/boards/${slug}/write`}
        className="hidden sm:block bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
      >
        글쓰기
      </Link>
    );
  }

  return (
    <Link
      href={`/boards/${slug}/write`}
      className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-forest-600 text-white shadow-lg shadow-forest-600/30 grid place-items-center"
      aria-label="글쓰기"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </Link>
  );
}
