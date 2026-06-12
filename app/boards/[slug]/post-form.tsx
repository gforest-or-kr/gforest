import Link from "next/link";

// 글쓰기/수정 공용 폼 — 마크업 복제 방지 (CLAUDE.md 원칙 5). 동작은 전달된 action에 위임.
export default function PostForm({
  action,
  boardName,
  boardType,
  cancelHref,
  submitLabel,
  error,
  defaultValues,
}: {
  action: (formData: FormData) => void | Promise<void>;
  boardName: string;
  boardType: string;
  cancelHref: string;
  submitLabel: string;
  error?: string;
  defaultValues?: { title?: string; content?: string; event_date?: string | null };
}) {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-24">
      <form action={action}>
        <div className="sticky top-14 lg:top-16 bg-white py-3 flex items-center justify-between border-b border-slate-100 z-10">
          <Link href={cancelHref} className="text-slate-500 text-sm p-2 -ml-2">
            ✕ 취소
          </Link>
          <span className="font-bold">
            {boardName} {submitLabel === "저장" ? "수정" : "글쓰기"}
          </span>
          <button className="bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2 rounded-xl">
            {submitLabel}
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
          defaultValue={defaultValues?.title}
          className="mt-4 w-full text-lg font-semibold border-b border-slate-100 focus:border-forest-300 outline-none py-3"
        />

        {boardType === "calendar" && (
          <label className="mt-4 flex items-center gap-3 text-sm">
            <span className="font-medium">📅 일정 날짜</span>
            <input
              type="date"
              name="event_date"
              required
              defaultValue={defaultValues?.event_date ?? undefined}
              className="border border-slate-200 rounded-xl px-3 py-2"
            />
          </label>
        )}

        <textarea
          name="content"
          required
          rows={16}
          placeholder="내용을 입력하세요"
          defaultValue={defaultValues?.content}
          className="mt-4 w-full leading-relaxed outline-none resize-y min-h-[40vh]"
        />
      </form>
    </main>
  );
}
