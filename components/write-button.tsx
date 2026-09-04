import Link from "next/link";

// 글쓰기 버튼 — 노출 여부(canWrite)는 서버 부모(게시판 page)가 세션 role과 write_roles로 계산해 넘긴다.
// UI 제어용이며 최종 차단은 posts_insert RLS(can_write_board).
export default function WriteButton({
  slug,
  canWrite,
  variant,
}: {
  slug: string;
  canWrite: boolean;
  variant: "header" | "fab";
}) {
  if (!canWrite) return null;

  if (variant === "header") {
    return (
      <Link
        href={`/boards/${slug}/write`}
        className="hidden sm:block bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
      >
        글쓰기
      </Link>
    );
  }

  return (
    <Link
      href={`/boards/${slug}/write`}
      className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-forest-600 text-white shadow-lg shadow-forest-600/30 grid place-items-center"
      aria-label="글쓰기"
    >
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
      </svg>
    </Link>
  );
}
