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

// 댓글 — 목록은 서버(공개글 ISR)·클라(회원글 아일랜드)에서 prop으로 받아 시작하고,
// 작성/삭제 후엔 브라우저 세션으로 다시 읽어 즉시 갱신한다(회원글은 클라 렌더라 서버
// 액션만으론 화면이 안 바뀐다). 권한 강제는 서버 액션 + RLS, 공개글 ISR 캐시는
// 서버 액션의 revalidateTag가 무효화한다. 답글(대댓글)은 루트 댓글에만 1단계로 단다.
export default function CommentSection({
  slug,
  postId,
  comments: initialComments,
  writeRoles,
}: {
  slug: string;
  postId: string;
  comments: CommentRow[];
  writeRoles: string[];
}) {
  const [me, setMe] = useState<{ uid: string; role: string } | null>(null);
  const [comments, setComments] = useState<CommentRow[]>(initialComments);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 서버에서 새 prop이 오면(다른 글 등) 동기화
  useEffect(() => {
    setComments(initialComments);
  }, [initialComments]);

  // 로그인 상태·역할 — 로그인/로그아웃을 구독해 즉시 반영
  useEffect(() => {
    let active = true;
    const supabase = createClient();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const uid = session?.user?.id;
      if (!uid) {
        if (active) setMe(null);
        return;
      }
      setTimeout(async () => {
        const { data: p } = await supabase.from("profiles").select("role").eq("id", uid).single();
        if (active) setMe(p?.role ? { uid, role: p.role } : null);
      }, 0);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function refetch() {
    const supabase = createClient();
    const { data } = await supabase
      .from("comments")
      .select("id, content, created_at, parent_id, author:profiles(id, nickname)")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at");
    if (data) setComments(data as unknown as CommentRow[]);
  }

  // 폼 제출 — 서버 액션(권한·RLS·ISR 무효화)으로 쓰고, 브라우저 세션으로 다시 읽어 즉시 반영
  async function submitComment(formData: FormData) {
    if (busy) return;
    setBusy(true);
    try {
      await createComment(slug, postId, formData);
      await refetch();
      setReplyTo(null);
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(id: string) {
    await deleteComment(slug, postId, id);
    await refetch();
  }

  const canComment = !!me && (me.role === "admin" || writeRoles.includes(me.role));
  const canDelete = (authorId: string | null | undefined) =>
    !!me && (me.role === "admin" || me.uid === authorId);

  const roots = comments.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const Item = ({ c, isRoot }: { c: CommentRow; isRoot: boolean }) => (
    <div className="rounded-2xl bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-2 text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{c.author?.nickname ?? "알 수 없음"}</span>
        <span className="text-slate-400">{shortDate(c.created_at)}</span>
        {canDelete(c.author?.id) && (
          <button onClick={() => removeComment(c.id)} className="ml-auto text-slate-300 hover:text-red-400">
            삭제
          </button>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
      {isRoot && canComment && (
        <button
          onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
          className="mt-2 text-xs font-medium text-slate-400 hover:text-forest-700"
        >
          {replyTo === c.id ? "취소" : "답글"}
        </button>
      )}
    </div>
  );

  const ReplyForm = ({ parentId, autoFocus }: { parentId?: string; autoFocus?: boolean }) => (
    <form action={submitComment} className="flex gap-2">
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <textarea
        name="content"
        required
        rows={2}
        autoFocus={autoFocus}
        placeholder={parentId ? "답글을 입력하세요" : "댓글을 입력하세요"}
        className="flex-1 border border-slate-200 rounded-xl text-sm p-3 resize-none"
      />
      <button
        disabled={busy}
        className="self-end bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2.5 rounded-xl shrink-0"
      >
        등록
      </button>
    </form>
  );

  return (
    <section className="mt-10 pt-6 border-t border-slate-100">
      <h2 className="font-bold mb-4">💬 댓글 {comments.length}</h2>
      <ul className="space-y-4">
        {roots.map((c) => (
          <li key={c.id}>
            <Item c={c} isRoot />
            {childrenOf(c.id).map((rc) => (
              <div key={rc.id} className="ml-8 mt-3">
                <Item c={rc} isRoot={false} />
              </div>
            ))}
            {replyTo === c.id && canComment && (
              <div className="ml-8 mt-3">
                <ReplyForm parentId={c.id} autoFocus />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canComment ? (
        <div className="mt-6">
          <ReplyForm />
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">
          {me ? "댓글 작성 권한이 없습니다" : "댓글을 쓰려면 로그인하세요"}
        </p>
      )}
    </section>
  );
}
