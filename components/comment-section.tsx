"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortDate } from "@/lib/format";
import { createComment, deleteComment } from "@/app/boards/[slug]/actions";

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  parent_id: string | null;
  author: { id: string; nickname: string } | null;
};

// 댓글 — 목록은 서버(ISR 캐시)에서 prop으로 받고, 폼/삭제 권한만 클라에서 세션으로 판단한다.
// 작성/삭제는 서버 액션(actions.ts)이 처리하고 revalidateTag(`post:`)로 즉시 무효화한다.
export default function CommentSection({
  slug,
  postId,
  comments,
  writeRoles,
}: {
  slug: string;
  postId: string;
  comments: CommentRow[];
  writeRoles: string[];
}) {
  const [me, setMe] = useState<{ uid: string; role: string } | null>(null);

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
      if (active && profile?.role) setMe({ uid, role: profile.role });
    })();
    return () => {
      active = false;
    };
  }, []);

  const canComment = !!me && (me.role === "admin" || writeRoles.includes(me.role));
  const canDelete = (authorId: string | null | undefined) =>
    !!me && (me.role === "admin" || me.uid === authorId);

  const roots = comments.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const commentAction = createComment.bind(null, slug, postId);

  const Item = ({ c }: { c: CommentRow }) => (
    <div className="rounded-2xl bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-2 text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{c.author?.nickname ?? "알 수 없음"}</span>
        <span className="text-slate-400">{shortDate(c.created_at)}</span>
        {canDelete(c.author?.id) && (
          <form action={deleteComment.bind(null, slug, postId, c.id)} className="ml-auto">
            <button className="text-slate-300 hover:text-red-400">삭제</button>
          </form>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
    </div>
  );

  return (
    <section className="mt-10 pt-6 border-t border-slate-100">
      <h2 className="font-bold mb-4">💬 댓글 {comments.length}</h2>
      <ul className="space-y-4">
        {roots.map((c) => (
          <li key={c.id}>
            <Item c={c} />
            {childrenOf(c.id).map((rc) => (
              <div key={rc.id} className="ml-8 mt-3">
                <Item c={rc} />
              </div>
            ))}
          </li>
        ))}
      </ul>

      {canComment ? (
        <form action={commentAction} className="mt-6 flex gap-2">
          <textarea
            name="content"
            required
            rows={2}
            placeholder="댓글을 입력하세요"
            className="flex-1 border border-slate-200 rounded-xl text-sm p-3 resize-none"
          />
          <button className="self-end bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2.5 rounded-xl shrink-0">
            등록
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-slate-400">
          {me ? "댓글 작성 권한이 없습니다" : "댓글을 쓰려면 로그인하세요"}
        </p>
      )}
    </section>
  );
}
