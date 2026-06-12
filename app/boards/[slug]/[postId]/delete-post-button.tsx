"use client";

export default function DeletePostButton({ action }: { action: () => Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("이 글을 삭제하시겠습니까? 되돌릴 수 없습니다.")) e.preventDefault();
      }}
    >
      <button className="text-slate-400 hover:text-red-500 px-2 py-1">삭제</button>
    </form>
  );
}
