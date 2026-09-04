import { notFound, redirect } from "next/navigation";
import { withUser, one } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type { Database } from "@/lib/db/types";
import { createPost } from "../actions";
import PostForm from "@/components/post-form";

export const dynamic = "force-dynamic";

type BoardRow = Database["public"]["Tables"]["boards"]["Row"];

// SCR-320 글쓰기 — 텍스트 작성 + 파일 첨부 (WYSIWYG 에디터는 후속)
export default async function WritePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/write`)}`);

  const board = await withUser(profile.id, (c) =>
    one<BoardRow>(c, "select * from boards where slug = $1 and is_active", [slug]),
  );
  if (!board) notFound();

  const canWrite =
    profile.role === "admin" || board.write_roles.includes(profile.role);
  if (!canWrite) redirect(`/boards/${slug}`);

  const action = createPost.bind(null, slug);

  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <PostForm
        action={action}
        boardType={board.board_type}
        headingText={`${board.name} 글쓰기`}
        cancelHref={`/boards/${slug}`}
        submitLabel="등록"
        error={error}
        showAttachments
        canPinNotice={profile.role === "admin" || profile.role === "operator"}
      />
    </main>
  );
}
