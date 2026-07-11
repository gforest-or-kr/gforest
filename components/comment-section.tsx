"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { shortDate, fullDate } from "@/lib/format";
import { createComment, updateComment, deleteComment } from "@/app/(site)/boards/[slug]/actions";

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  parent_id: string | null;
  author: { id: string; nickname: string } | null;
};

// 댓글 — 목록은 서버(공개글 ISR)·클라(회원글 아일랜드)에서 prop으로 받아 시작한다.
// 작성/수정/삭제는 낙관적 업데이트(GFM-65): 상태를 즉시 반영하고 서버 액션 실패 시 롤백한다.
// 작성은 성공 후 재조회로 임시 id를 실제 행으로 교체한다(busy 가드가 재조회 중 중복 제출을
// 막아 낙관 행 유실 경합이 없다). 권한 강제는 기존대로 서버 액션 + RLS, 공개글 ISR 캐시는
// 서버 액션의 revalidateTag가 무효화한다. 답글(대댓글)은 루트 댓글에만 1단계. 등록·삭제는 confirm 확인.
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
  const [me, setMe] = useState<{ uid: string; role: string; nickname: string } | null>(null);
  const [comments, setComments] = useState<CommentRow[]>(initialComments);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        const { data: p } = await supabase.from("profiles").select("role, nickname").eq("id", uid).single();
        if (active) setMe(p?.role ? { uid, role: p.role, nickname: p.nickname } : null);
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
      .select("id, content, created_at, edited_at, parent_id, author:profiles(id, nickname)")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at");
    if (data) setComments(data as unknown as CommentRow[]);
  }

  // 작성/답글 등록 — confirm 후 낙관적으로 즉시 추가, 서버 액션 실패 시 롤백.
  // 성공 시 재조회로 임시 id를 실제 행으로 교체(체감 지연 0, busy가 중복 제출 차단)
  async function onCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const content = String(fd.get("content") ?? "").trim();
    if (!content || busy || !me) return;
    if (!confirm("댓글을 등록할까요?")) return;
    const prev = comments;
    setComments([
      ...comments,
      {
        id: `optimistic-${Date.now()}`,
        content,
        created_at: new Date().toISOString(),
        edited_at: null,
        parent_id: fd.get("parent_id") ? String(fd.get("parent_id")) : null,
        author: { id: me.uid, nickname: me.nickname },
      },
    ]);
    form.reset();
    setReplyTo(null);
    setBusy(true);
    try {
      const res = await createComment(slug, postId, fd);
      if (res?.error) {
        setComments(prev);
        alert(res.error);
        return;
      }
      await refetch();
    } catch {
      setComments(prev);
      alert("댓글 등록에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 수정 저장 — 낙관적으로 즉시 반영, 실패 시 롤백. 성공 시 재조회로 서버 기준 edited_at 반영
  async function onEdit(e: React.FormEvent<HTMLFormElement>, commentId: string) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const content = String(fd.get("content") ?? "").trim();
    if (!content || busy) return;
    const prev = comments;
    setComments(
      comments.map((c) =>
        c.id === commentId ? { ...c, content, edited_at: new Date().toISOString() } : c,
      ),
    );
    setEditing(null);
    setBusy(true);
    try {
      const res = await updateComment(slug, postId, commentId, fd);
      if (res?.error) {
        setComments(prev);
        alert(res.error);
        return;
      }
      await refetch();
    } catch {
      setComments(prev);
      alert("댓글 수정에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  // 삭제 — 낙관적으로 즉시 제거, 실패 시 롤백(성공 시 상태가 이미 서버와 일치해 재조회 불필요)
  async function onDelete(id: string) {
    if (busy || !confirm("댓글을 삭제할까요? 되돌릴 수 없습니다.")) return;
    // 대상 행만 제거 — 서버도 대상만 soft-delete하고 답글은 남긴다(부모 없는 답글은 렌더에서
    // 걸러짐). 재조회 결과와 동일한 상태를 유지해 낙관/서버 표현이 갈라지지 않게 한다.
    const prev = comments;
    setComments(comments.filter((c) => c.id !== id));
    setBusy(true);
    try {
      const res = await deleteComment(slug, postId, id);
      if (res?.error) {
        setComments(prev);
        alert(res.error);
        return;
      }
    } catch {
      setComments(prev);
      alert("댓글 삭제에 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setBusy(false);
    }
  }

  const canComment = !!me && (me.role === "admin" || writeRoles.includes(me.role));
  const canModify = (authorId: string | null | undefined) =>
    !!me && (me.role === "admin" || me.uid === authorId);

  const roots = comments.filter((c) => !c.parent_id);
  const childrenOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const Item = ({ c, isRoot }: { c: CommentRow; isRoot: boolean }) => (
    <div className="rounded-2xl bg-slate-50/70 p-3.5">
      <div className="flex items-center flex-wrap gap-x-2 gap-y-1 text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{c.author?.nickname ?? "알 수 없음"}</span>
        <span className="text-slate-400">{shortDate(c.created_at)}</span>
        {c.edited_at && (
          <span className="text-slate-400">· 수정됨 {fullDate(c.edited_at)}</span>
        )}
        {canModify(c.author?.id) && editing !== c.id && (
          <span className="ml-auto flex gap-2">
            <button onClick={() => setEditing(c.id)} className="text-slate-300 hover:text-forest-700">
              수정
            </button>
            <button onClick={() => onDelete(c.id)} className="text-slate-300 hover:text-red-400">
              삭제
            </button>
          </span>
        )}
      </div>

      {editing === c.id ? (
        <form onSubmit={(e) => onEdit(e, c.id)} className="flex flex-col gap-2">
          <textarea
            name="content"
            required
            rows={2}
            autoFocus
            defaultValue={c.content}
            className="w-full border border-slate-200 rounded-xl text-sm p-3 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="text-sm text-slate-400 px-3 py-1.5"
            >
              취소
            </button>
            <button
              disabled={busy}
              className="bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-1.5 rounded-xl"
            >
              저장
            </button>
          </div>
        </form>
      ) : (
        <>
          <p className="text-sm whitespace-pre-wrap break-words">{c.content}</p>
          {isRoot && canComment && (
            <button
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
              className="mt-2 text-xs font-medium text-slate-400 hover:text-forest-700"
            >
              {replyTo === c.id ? "취소" : "답글"}
            </button>
          )}
        </>
      )}
    </div>
  );

  const CommentForm = ({ parentId, autoFocus }: { parentId?: string; autoFocus?: boolean }) => (
    <form onSubmit={onCreate} className="flex gap-2">
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
                <CommentForm parentId={c.id} autoFocus />
              </div>
            )}
          </li>
        ))}
      </ul>

      {canComment ? (
        <div className="mt-6">
          <CommentForm />
        </div>
      ) : (
        <p className="mt-6 text-sm text-slate-400">
          {me ? "댓글 작성 권한이 없습니다" : "댓글을 쓰려면 로그인하세요"}
        </p>
      )}
    </section>
  );
}
