"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DeletePostButton from "./delete-post-button";

// 글 수정/삭제 버튼 — 개인화(본인/admin)라 클라이언트에서 세션 role로 판단한다.
// 이걸 클라로 분리해야 글 상세 page가 쿠키를 안 읽어 ISR + prefetch가 가능해진다.
export default function PostActions({
  slug,
  postId,
  authorId,
  deleteAction,
}: {
  slug: string;
  postId: string;
  authorId: string | null;
  deleteAction: () => Promise<void>;
}) {
  const [show, setShow] = useState(false);

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
      if (active && (uid === authorId || profile?.role === "admin")) setShow(true);
    })();
    return () => {
      active = false;
    };
  }, [authorId]);

  if (!show) return null;

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/boards/${slug}/${postId}/edit`}
        className="text-slate-400 hover:text-forest-700 px-2 py-1"
      >
        수정
      </Link>
      <DeletePostButton action={deleteAction} />
    </div>
  );
}
