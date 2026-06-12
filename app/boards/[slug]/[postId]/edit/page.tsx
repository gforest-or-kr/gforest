import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { updatePost } from "../../actions";
import PostForm from "@/components/post-form";

export const dynamic = "force-dynamic";

// SCR-320 수정 — 글쓰기 폼을 재사용해 제목·본문(달력은 일정)을 채운 상태로 진입. 첨부 편집은 범위 외.
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
      .select("title, content, event_date, author:profiles(id), boards!inner(slug)")
      .eq("id", postId)
      .eq("boards.slug", slug)
      .is("deleted_at", null)
      .single(),
  ]);
  if (!board || !post) notFound();
  if (!profile)
    redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  // UI 차단 — 최종 차단은 RLS(posts_update: author/admin). 비작성자·비admin은 상세로 되돌린다.
  const isAuthor = profile.id === (post.author as { id: string } | null)?.id;
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
        defaults={{ title: post.title, content: post.content, eventDate: post.event_date }}
        showAttachments={false}
      />
    </main>
  );
}
