import { notFound, redirect } from "next/navigation";
import { withUser, one, many } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type { Database } from "@/lib/db/types";
import { updatePost } from "../../actions";
import PostForm from "@/components/post-form";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type BoardRow = Database["public"]["Tables"]["boards"]["Row"];

// SCR-320 수정 — 글쓰기 폼을 재사용해 제목·본문(달력은 일정)·기존 첨부를 채운 상태로 진입.
export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; postId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, postId } = await params;
  const { error } = await searchParams;
  if (!UUID_RE.test(postId)) notFound();

  const profile = await getSessionProfile();
  if (!profile)
    redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  // 사용자 RLS 컨텍스트로 조회 — 읽기 권한이 없으면 posts_select가 0행을 돌려준다
  const [board, post, attachments] = await withUser(profile.id, (c) =>
    Promise.all([
      one<BoardRow>(c, "select * from boards where slug = $1 and is_active", [slug]),
      one<{
        title: string; content: string; event_date: string | null; is_notice: boolean;
        legacy_document_srl: number | null; author_id: string;
      }>(
        c,
        `select p.title, p.content, to_char(p.event_date, 'YYYY-MM-DD') as event_date, p.is_notice,
                p.legacy_document_srl::int as legacy_document_srl, p.author_id
           from posts p join boards b on b.id = p.board_id
          where p.id = $1 and b.slug = $2 and p.deleted_at is null`,
        [postId, slug],
      ),
      many<{ id: string; file_name: string; byte_size: number; mime_type: string | null }>(
        c,
        "select id, file_name, byte_size::int as byte_size, mime_type from attachments where post_id = $1 order by created_at",
        [postId],
      ),
    ]),
  );
  if (!board || !post) notFound();

  // UI 차단 — 최종 차단은 RLS(posts_update: author/admin). 비작성자·비admin은 상세로 되돌린다.
  const isAuthor = profile.id === post.author_id;
  const isAdmin = profile.role === "admin";
  if (!(isAuthor || isAdmin)) redirect(`/boards/${slug}/${postId}`);

  const action = updatePost.bind(null, slug, postId);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <PostForm
        action={action}
        boardType={board.board_type}
        headingText={`${board.name} 수정`}
        cancelHref={`/boards/${slug}/${postId}`}
        submitLabel="저장"
        error={error}
        defaults={{
          title: post.title,
          content: post.content,
          eventDate: post.event_date,
          isNotice: post.is_notice,
        }}
        showAttachments
        initialAttachments={attachments}
        canPinNotice={profile.role === "admin" || profile.role === "operator"}
        richText={!post.legacy_document_srl}
      />
    </main>
  );
}
