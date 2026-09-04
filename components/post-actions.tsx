import Link from "next/link";
import DeletePostButton from "./delete-post-button";

// 글 수정/삭제 버튼 — 노출 여부(본인/admin)는 서버 부모가 세션 profile로 계산해 props로 넘긴다.
// UI 제어용이며 최종 차단은 posts_update RLS.
export default function PostActions({
  slug,
  postId,
  canModify,
  deleteAction,
}: {
  slug: string;
  postId: string;
  canModify: boolean;
  deleteAction: () => Promise<void>;
}) {
  if (!canModify) return null;

  return (
    <div className="flex items-center gap-1">
      <Link
        href={`/boards/${slug}/${postId}/edit`}
        className="text-slate-400 hover:text-forest-700 px-2 py-1"
      >
        수정
      </Link>
      <DeletePostButton action={deleteAction} />
    </div>
  );
}
