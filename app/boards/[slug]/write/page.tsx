import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { createPost } from "../actions";
import AttachmentField from "@/components/attachment-field";

export const dynamic = "force-dynamic";

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
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <form action={action}>
        <div className="sticky top-14 lg:top-16 bg-white py-3 flex items-center justify-between border-b border-slate-100 z-10">
          <Link href={`/boards/${slug}`} className="text-slate-500 text-sm p-2 -ml-2">
            ✕ 취소
          </Link>
          <span className="font-bold">{board.name} 글쓰기</span>
          <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
            등록
          </button>
        </div>

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 text-red-600 text-sm px-4 py-3">{error}</p>
        )}

        <input
          name="title"
          required
          maxLength={200}
          placeholder="제목"
          className="mt-4 w-full text-lg font-semibold border-b border-slate-100 focus:border-forest-300 outline-none py-3"
        />

        {board.board_type === "calendar" && (
          <label className="mt-4 flex items-center gap-3 text-sm">
            <span className="font-medium">📅 일정 날짜</span>
            <input
              type="date"
              name="event_date"
              required
              className="border border-slate-200 rounded-xl px-3 py-2"
            />
          </label>
        )}

        <textarea
          name="content"
          required
          rows={16}
          placeholder="내용을 입력하세요"
          className="mt-4 w-full leading-relaxed outline-none resize-y min-h-[40vh]"
        />

        <AttachmentField />
      </form>
    </main>
  );
}
