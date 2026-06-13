import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { publicClient } from "@/lib/supabase/public";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import { getBoardMeta, getPostDetail } from "@/lib/boards";
import { fullDate } from "@/lib/format";
import AccessNotice from "@/components/access-notice";
import ViewCounter from "@/components/view-counter";
import PostActions from "@/components/post-actions";
import CommentSection from "@/components/comment-section";
import PostError from "@/components/post-error";
import { deletePost } from "../actions";

// 공개 게시판 글은 ISR(prefetch 작동), 권한 게시판 글은 쿠키를 읽어 동적 렌더된다.
export const revalidate = 300; // 첨부 서명 URL(1시간)보다 짧게 → 항상 유효
export async function generateStaticParams() {
  return []; // 온디맨드 ISR — 첫 방문 시 생성·캐시
}

type Detail = NonNullable<Awaited<ReturnType<typeof getPostDetail>>>;

// 권한 게시판 글 — 쿠키 세션(RLS)으로 동적 조회. getPostDetail(publicClient)은 anon이라
// 권한 글을 못 읽으므로 별도 경로.
async function fetchPostDynamic(slug: string, postId: string): Promise<Detail | null> {
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*, author:profiles(id, nickname), boards!inner(slug)")
    .eq("id", postId)
    .eq("boards.slug", slug)
    .is("deleted_at", null)
    .single();
  if (!post) return null;
  const [{ data: comments }, { data: attachments }, { data: prevPost }, { data: nextPost }] =
    await Promise.all([
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
        .eq("board_id", post.board_id)
        .is("deleted_at", null)
        .lt("created_at", post.created_at)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("posts")
        .select("id, title")
        .eq("board_id", post.board_id)
        .is("deleted_at", null)
        .gt("created_at", post.created_at)
        .order("created_at")
        .limit(1)
        .maybeSingle(),
    ]);
  return { post, comments: comments ?? [], attachments: attachments ?? [], prevPost, nextPost };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const board = await getBoardMeta(slug);
  if (!board) notFound();

  let detail: Detail | null;
  let signer: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof publicClient>;

  if (board.read_roles === null) {
    detail = await getPostDetail(slug, postId); // ISR 캐시
    signer = publicClient();
  } else {
    const profile = await getSessionProfile();
    if (!canReadBoard(board.read_roles, profile?.role ?? null)) {
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
    detail = await fetchPostDynamic(slug, postId);
    signer = await createClient();
  }

  if (!detail || !detail.post) notFound();
  const { post, comments, attachments, prevPost, nextPost } = detail;
  const author = post.author as { id: string; nickname: string } | null;

  // 첨부 서명 URL — ISR 주기(300s) < 서명 만료(1시간)이라 항상 유효
  const signed = await Promise.all(
    attachments.map(async (f) => {
      const { data } = await signer.storage.from("attachments").createSignedUrl(f.storage_path, 3600);
      return { ...f, url: data?.signedUrl ?? null };
    }),
  );

  const deletePostAction = deletePost.bind(null, slug, postId);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <div className="mt-6 mb-4 flex items-center justify-between text-sm">
        <Link href={`/boards/${slug}`} className="text-slate-500 hover:text-forest-700">
          ← {board.name}
        </Link>
        <PostActions
          slug={slug}
          postId={postId}
          authorId={author?.id ?? null}
          deleteAction={deletePostAction}
        />
      </div>

      <Suspense fallback={null}>
        <PostError />
      </Suspense>

      <article>
        <h1 className="text-2xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {author?.nickname ?? "알 수 없음"} · {fullDate(post.created_at)} · 조회{" "}
          <ViewCounter postId={postId} baseCount={post.view_count} />
        </p>
        {post.event_date && (
          <p className="mt-2 inline-block rounded-xl bg-forest-50 text-forest-700 text-sm font-semibold px-3 py-1.5">
            📅 일정: {post.event_date}
          </p>
        )}
        {post.legacy_document_srl ? (
          <div
            className="mt-6 pt-6 border-t border-slate-100 leading-relaxed break-words [&_img]:max-w-full [&_img]:h-auto [&_p]:my-2"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className="mt-6 pt-6 border-t border-slate-100 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </div>
        )}

        {signed.length > 0 && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">📎 첨부 {signed.length}개</p>
            <ul className="space-y-1.5">
              {signed.map((f) => {
                const isImage = f.mime_type?.startsWith("image/");
                return (
                  <li key={f.id} className="text-sm">
                    {f.url ? (
                      <a href={f.url} className="text-forest-700 hover:underline" download={f.file_name}>
                        {f.file_name}
                      </a>
                    ) : (
                      <span className="text-slate-400">{f.file_name} (권한 없음)</span>
                    )}
                    <span className="text-xs text-slate-400 ml-2">
                      {(f.byte_size / 1024 / 1024).toFixed(2)}MB
                    </span>
                    {f.url && isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={f.url}
                        alt={f.file_name}
                        loading="lazy"
                        className="mt-2 max-w-full h-auto rounded-xl"
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      <CommentSection
        slug={slug}
        postId={postId}
        comments={comments}
        writeRoles={board.write_roles}
      />

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
