"use client";

// 상세 페이지는 서버 컴포넌트라 confirm()을 직접 쓸 수 없어 삭제 폼만 분리한다.
// 취소하면 폼 제출(=서버 액션) 자체가 일어나지 않는다.
export default function DeletePostButton({
  action,
}: {
  action: () => Promise<void>;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("이 글을 삭제할까요? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <button className="text-slate-400 hover:text-red-500 px-2 py-1">삭제</button>
    </form>
  );
}
