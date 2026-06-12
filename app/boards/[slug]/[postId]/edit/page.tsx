import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updatePost } from "../../actions";
import PostForm from "../../post-form";

export const dynamic = "force-dynamic";

// SCR-320 글 수정 — 글쓰기 폼(PostForm)을 재사용. 권한 강제는 RLS(posts_update),
// 여기 게이트는 UI 노출/접근 제어용 (CLAUDE.md 원칙 3)
export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; postId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, postId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [profile, { data: board }, { data: post }] = await Promise.all([
    getSessionProfile(),
    supabase.from("boards").select("*").eq("slug", slug).single(),
    supabase
      .from("posts")
      .select("id, title, content, event_date, author_id, boards!inner(slug)")
      .eq("id", postId)
      .eq("boards.slug", slug)
      .is("deleted_at", null)
      .single(),
  ]);
  if (!board || !post) notFound();

  if (!profile) {
    redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);
  }

  const isAuthor = profile.id === post.author_id;
  const isAdmin = profile.role === "admin";
  if (!isAuthor && !isAdmin) redirect(`/boards/${slug}/${postId}`);

  const action = updatePost.bind(null, slug, postId);

  return (
    <PostForm
      action={action}
      boardName={board.name}
      boardType={board.board_type}
      cancelHref={`/boards/${slug}/${postId}`}
      submitLabel="저장"
      error={error}
      defaultValues={{
        title: post.title,
        content: post.content,
        event_date: post.event_date,
      }}
    />
  );
}
