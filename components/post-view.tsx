import Link from "next/link";
import { Suspense } from "react";
import { fullDate } from "@/lib/format";
import ViewCounter from "@/components/view-counter";
import PostActions from "@/components/post-actions";
import CommentSection from "@/components/comment-section";
import PostError from "@/components/post-error";
import { deletePost } from "@/app/boards/[slug]/actions";

// 글 상세 본문 — 서버(공개글 ISR)·클라(회원글) 양쪽에서 재사용하는 프레젠테이션 컴포넌트.
// 데이터를 props로만 받고 쿠키/비동기를 쓰지 않아 어느 트리에서든 렌더된다.
export type PostViewData = {
  slug: string;
  boardName: string;
  writeRoles: string[];
  post: {
    id: string;
    title: string;
    content: string;
    view_count: number;
    created_at: string;
    event_date: string | null;
    legacy_document_srl: number | null;
  };
  author: { id: string; nickname: string } | null;
  attachments: { id: string; file_name: string; byte_size: number; mime_type: string | null; url: string | null }[];
  comments: Parameters<typeof CommentSection>[0]["comments"];
  prevPost: { id: string; title: string } | null;
  nextPost: { id: string; title: string } | null;
};

export default function PostView({
  slug,
  boardName,
  writeRoles,
  post,
  author,
  attachments,
  comments,
  prevPost,
  nextPost,
}: PostViewData) {
  const deletePostAction = deletePost.bind(null, slug, post.id);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <div className="mt-6 mb-4 flex items-center justify-between text-sm">
        <Link href={`/boards/${slug}`} className="text-slate-500 hover:text-forest-700">
          ← {boardName}
        </Link>
        <PostActions slug={slug} postId={post.id} authorId={author?.id ?? null} deleteAction={deletePostAction} />
      </div>

      <Suspense fallback={null}>
        <PostError />
      </Suspense>

      <article>
        <h1 className="text-2xl font-bold leading-snug">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {author?.nickname ?? "알 수 없음"} · {fullDate(post.created_at)} · 조회{" "}
          <ViewCounter postId={post.id} baseCount={post.view_count} />
        </p>
        {post.event_date && (
          <p className="mt-2 inline-block rounded-xl bg-forest-50 text-forest-700 text-sm font-semibold px-3 py-1.5">
            📅 일정: {post.event_date}
          </p>
        )}
        {post.legacy_document_srl ? (
          <div
            // 레거시 본문은 고정폭 래퍼·인라인 width 이미지를 품어 [&_*]:max-w-full로 모든 자손을 폭 제한
            className="mt-6 pt-6 border-t border-slate-100 leading-relaxed break-words [&_*]:max-w-full [&_img]:h-auto [&_p]:my-2 [&_table]:block [&_table]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <div className="mt-6 pt-6 border-t border-slate-100 leading-relaxed whitespace-pre-wrap break-words">
            {post.content}
          </div>
        )}

        {attachments.length > 0 && (
          <div className="mt-6 rounded-2xl bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-500 mb-2">📎 첨부 {attachments.length}개</p>
            <ul className="space-y-1.5">
              {attachments.map((f) => {
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
                    <span className="text-xs text-slate-400 ml-2">{(f.byte_size / 1024 / 1024).toFixed(2)}MB</span>
                    {f.url && isImage && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={f.url} alt={f.file_name} loading="lazy" className="mt-2 max-w-full h-auto rounded-xl" />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </article>

      <CommentSection slug={slug} postId={post.id} comments={comments} writeRoles={writeRoles} />

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
