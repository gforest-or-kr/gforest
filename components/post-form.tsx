import Link from "next/link";
import AttachmentField from "@/components/attachment-field";
import RichEditor from "@/components/rich-editor";

// 글쓰기/수정 공용 폼 — 동일한 마크업·탭타겟·sticky 헤더를 재사용한다 (CLAUDE.md: 유지보수 우선).
// 서버 컴포넌트로 두고, 내부 AttachmentField·RichEditor만 클라이언트로 동작한다.
// richText면 WYSIWYG(에디터), 아니면 plain textarea(레거시 글 수정 등 HTML 보존이 필요한 경우).
export default function PostForm({
  action,
  boardType,
  headingText,
  cancelHref,
  submitLabel,
  error,
  defaults,
  showAttachments,
  initialAttachments,
  canPinNotice = false,
  richText = true,
}: {
  action: (formData: FormData) => Promise<void>;
  boardType: string;
  headingText: string;
  cancelHref: string;
  submitLabel: string;
  error?: string;
  defaults?: {
    title?: string | null;
    content?: string | null;
    eventDate?: string | null;
    isNotice?: boolean | null;
  };
  showAttachments: boolean;
  canPinNotice?: boolean;
  richText?: boolean;
  initialAttachments?: {
    id: string;
    file_name: string;
    byte_size: number;
    mime_type: string | null;
  }[];
}) {
  return (
    <form action={action}>
      <div className="sticky top-14 lg:top-16 bg-white py-3 flex items-center justify-between border-b border-slate-100 z-10">
        <Link href={cancelHref} className="text-slate-500 text-sm p-2 -ml-2">
          ✕ 취소
        </Link>
        <span className="font-bold">{headingText}</span>
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
        defaultValue={defaults?.title ?? ""}
        className="mt-4 w-full text-lg font-semibold border-b border-slate-100 focus:border-forest-300 outline-none py-3"
      />

      {/* 공지 고정은 운영자·관리자만 노출 — 최종 강제는 guard_is_notice 트리거(컬럼 권한) */}
      {canPinNotice && (
        <label className="mt-4 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="is_notice"
            defaultChecked={defaults?.isNotice ?? false}
            className="w-4 h-4 accent-forest-600"
          />
          <span className="font-medium">📌 공지로 등록 (목록 상단 고정)</span>
        </label>
      )}

      {boardType === "calendar" && (
        <label className="mt-4 flex items-center gap-3 text-sm">
          <span className="font-medium">📅 일정 날짜</span>
          <input
            type="date"
            name="event_date"
            required
            defaultValue={defaults?.eventDate ?? ""}
            className="border border-slate-200 rounded-xl px-3 py-2"
          />
        </label>
      )}

      <input type="hidden" name="is_html" value={richText ? "1" : ""} />
      {richText ? (
        <RichEditor name="content" defaultValue={defaults?.content ?? ""} />
      ) : (
        <textarea
          name="content"
          required
          rows={16}
          placeholder="내용을 입력하세요"
          defaultValue={defaults?.content ?? ""}
          className="mt-4 w-full leading-relaxed outline-none resize-y min-h-[40vh]"
        />
      )}

      {showAttachments && <AttachmentField initial={initialAttachments} />}
    </form>
  );
}
