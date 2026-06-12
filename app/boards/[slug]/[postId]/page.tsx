import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import { fullDate, shortDate } from "@/lib/format";
import AccessNotice from "@/components/access-notice";
import { createComment, deleteComment, deletePost } from "../actions";

export const dynamic = "force-dynamic";

type Params = { slug: string; postId: string };

export default async function PostPage({ params }: { params: Promise<Params> }) {
  const { slug, postId } = await params;
  const supabase = await createClient();

  // 프로필·게시판·글을 1회 왕복에 병렬 조회 (GFM-30 — 워터폴 제거)
  const [profile, { data: board }, { data: post }] = await Promise.all([
    getSessionProfile(),
    supabase.from("boards").select("*").eq("slug", slug).single(),
    supabase
      .from("posts")
      .select("*, author:profiles(id, nickname), boards!inner(slug)")
      .eq("id", postId)
      .eq("boards.slug", slug)
      .is("deleted_at", null)
      .single(),
  ]);
  if (!board) notFound();

  const role = profile?.role ?? null;
  if (!canReadBoard(board.read_roles, role)) {
    return (
      <main className="max-w-3xl mx-auto px-4">
        <AccessNotice
          boardName={board.name}
          readRoles={board.read_roles ?? []}
          loggedIn={!!profile}
          returnTo={`/boards/${slug}/${postId}`}
        />
      </main>
    );
  }

  if (!post) notFound();

  // 조회수 증가 (RPC, 실패 무시) + 댓글·첨부·이전/다음 병렬 조회
  const [{ data: comments }, { data: attachments }, { data: prevPost }, { data: nextPost }] = await Promise.all([
    supabase
      .from("comments")
      .select("id, content, created_at, parent_id, author:profiles(id, nickname)")
      .eq("post_id", postId)
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("attachments")
      .select("id, file_name, byte_size, storage_path, mime_type")
      .eq("post_id", postId)
      .order("created_at"),
    supabase
      .from("posts")
      .select("id, title")
      .eq("board_id", board.id)
      .is("deleted_at", null)
      .lt("created_at", post.created_at)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("posts")
      .select("id, title")
      .eq("board_id", board.id)
      .is("deleted_at", null)
      .gt("created_at", post.created_at)
      .order("created_at")
      .limit(1)
      .maybeSingle(),
    supabase.rpc("increment_view_count", { p_post_id: postId }),
  ]);

  const author = post.author as { id: string; nickname: string } | null;
  const isAuthor = !!profile && profile.id === author?.id;
  const isAdmin = role === "admin";
  const canComment =
    !!role && (role === "admin" || board.write_roles.includes(role));

  // 1단계 대댓글 트리 구성
  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const childrenOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id);

  const deletePostAction = deletePost.bind(null, slug, postId);
  const commentAction = createComment.bind(null, slug, postId);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <div className="mt-6 mb-4 flex items-center justify-between text-sm">
        <Link href={`/boards/${slug}`} className="text-slate-500 hover:text-forest-700">
          ← {board.name}
        </Link>
        {(isAuthor || isAdmin) && (
          <form action={deletePostAction}>
            <button className="text-slate-400 hover:text-red-500 px-2 py-1">삭제</button>
          </form>
        )}
      </div>

      <article>
        <h1 className="text-2xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {author?.nickname ?? "알 수 없음"} · {fullDate(post.created_at)} · 조회{" "}
          {post.view_count + 1}
        </p>
        {post.event_date && (
          <p className="mt-2 inline-block rounded-xl bg-forest-50 text-forest-700 text-sm font-semibold px-3 py-1.5">
            📅 일정: {post.event_date}
          </p>
        )}
        {post.legacy_document_srl ? (
          // XE 이관 글 — ETL에서 sanitize된 HTML (이미지 반응형 강제)
          <div
            className="mt-6 pt-6 border-t border-slate-100 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className="mt-6 pt-6 border-t border-slate-100 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </div>
        )}

        {/* 첨부파일 — 서명 URL(1시간), 접근 권한은 storage RLS가 게시판 권한과 동일 강제 */}
        {(attachments ?? []).length > 0 && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">
              📎 첨부 {(attachments ?? []).length}개
            </p>
            <ul className="space-y-1.5">
              {await Promise.all(
                (attachments ?? []).map(async (f) => {
                  const { data: signed } = await supabase.storage
                    .from("attachments")
                    .createSignedUrl(f.storage_path, 3600);
                  const isImage = f.mime_type?.startsWith("image/");
                  return (
                    <li key={f.id} className="text-sm">
                      {signed ? (
                        <a
                          href={signed.signedUrl}
                          className="text-forest-700 hover:underline"
                          download={f.file_name}
                        >
                          {f.file_name}
                        </a>
                      ) : (
                        <span className="text-slate-400">{f.file_name} (권한 없음)</span>
                      )}
                      <span className="text-xs text-slate-400 ml-2">
                        {(f.byte_size / 1024 / 1024).toFixed(2)}MB
                      </span>
                      {signed && isImage && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={signed.signedUrl}
                          alt={f.file_name}
                          loading="lazy"
                          className="mt-2 max-w-full h-auto rounded-xl"
                        />
                      )}
                    </li>
                  );
                }),
              )}
            </ul>
          </div>
        )}
      </article>

      {/* 댓글 */}
      <section className="mt-10 pt-6 border-t border-slate-100">
        <h2 className="font-bold mb-4">💬 댓글 {(comments ?? []).length}</h2>
        <ul className="space-y-4">
          {roots.map((c) => {
            const cAuthor = c.author as { id: string; nickname: string } | null;
            return (
              <li key={c.id}>
                <CommentItem
                  comment={c}
                  authorName={cAuthor?.nickname ?? "알 수 없음"}
                  canDelete={isAdmin || (!!profile && profile.id === cAuthor?.id)}
                  onDelete={deleteComment.bind(null, slug, postId, c.id)}
                />
                {childrenOf(c.id).map((rc) => {
                  const rcAuthor = rc.author as { id: string; nickname: string } | null;
                  return (
                    <div key={rc.id} className="ml-8 mt-3">
                      <CommentItem
                        comment={rc}
                        authorName={rcAuthor?.nickname ?? "알 수 없음"}
                        canDelete={isAdmin || (!!profile && profile.id === rcAuthor?.id)}
                        onDelete={deleteComment.bind(null, slug, postId, rc.id)}
                      />
                    </div>
                  );
                })}
              </li>
            );
          })}
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
            {profile ? "댓글 작성 권한이 없습니다" : "댓글을 쓰려면 로그인하세요"}
          </p>
        )}
      </section>

      {/* 이전/다음 */}
      <nav className="mt-10 border-t border-slate-100 divide-y divide-slate-50 text-sm">
        {nextPost && (
          <Link href={`/boards/${slug}/${nextPost.id}`} className="flex gap-3 py-3 hover:text-forest-700">
            <span className="text-slate-400 shrink-0">다음글 ▲</span>
            <span className="truncate">{nextPost.title}</span>
          </Link>
        )}
        {prevPost && (
          <Link href={`/boards/${slug}/${prevPost.id}`} className="flex gap-3 py-3 hover:text-forest-700">
            <span className="text-slate-400 shrink-0">이전글 ▼</span>
            <span className="truncate">{prevPost.title}</span>
          </Link>
        )}
      </nav>
    </main>
  );
}

function CommentItem({
  comment,
  authorName,
  canDelete,
  onDelete,
}: {
  comment: { content: string; created_at: string };
  authorName: string;
  canDelete: boolean;
  onDelete: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl bg-slate-50/70 p-3.5">
      <div className="flex items-center gap-2 text-xs mb-1.5">
        <span className="font-semibold text-slate-700">{authorName}</span>
        <span className="text-slate-400">{shortDate(comment.created_at)}</span>
        {canDelete && (
          <form action={onDelete} className="ml-auto">
            <button className="text-slate-300 hover:text-red-400">삭제</button>
          </form>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{comment.content}</p>
    </div>
  );
}
