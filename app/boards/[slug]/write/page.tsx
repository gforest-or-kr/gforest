import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createPost } from "../actions";
import PostForm from "../post-form";

export const dynamic = "force-dynamic";

// SCR-320 글쓰기 — 1차: 텍스트 작성 (WYSIWYG 에디터·파일 첨부는 후속)
export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [profile, { data: board }] = await Promise.all([
    getSessionProfile(),
    supabase.from("boards").select("*").eq("slug", slug).single(),
  ]);
  if (!board) notFound();
  if (!profile) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/write`)}`);

  const canWrite =
    profile.role === "admin" || board.write_roles.includes(profile.role);
  if (!canWrite) redirect(`/boards/${slug}`);

  const action = createPost.bind(null, slug);

  return (
    <PostForm
      action={action}
      boardName={board.name}
      boardType={board.board_type}
      cancelHref={`/boards/${slug}`}
      submitLabel="등록"
      error={error}
    />
  );
}
