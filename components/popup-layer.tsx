"use client";

import { useEffect, useState } from "react";

type Popup = {
  id: string;
  title: string;
  body: string;
  link_url: string | null;
  dismiss_days: number;
};

// SCR-110 레이어 팝업 — D: 중앙 모달 / M: 바텀시트. 복수 시 한 개씩 순차 표시
export default function PopupLayer({ popups }: { popups: Popup[] }) {
  const [queue, setQueue] = useState<Popup[]>([]);

  useEffect(() => {
    // localStorage는 클라이언트에서만 읽을 수 있어 마운트 후 결정한다(동기 setState 경고 회피를 위해 다음 틱)
    const t = setTimeout(() => {
      const now = Date.now();
      setQueue(
        popups.filter((p) => {
          const until = localStorage.getItem(`popup_dismiss_${p.id}`);
          return !until || Number(until) < now;
        }),
      );
    }, 0);
    return () => clearTimeout(t);
  }, [popups]);

  const popup = queue[0];
  if (!popup) return null;

  function close(dismissDays?: number) {
    if (dismissDays && popup) {
      localStorage.setItem(
        `popup_dismiss_${popup.id}`,
        String(Date.now() + dismissDays * 86400_000),
      );
    }
    setQueue((q) => q.slice(1));
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center sm:justify-center">
      <div className="bg-white w-full sm:w-[420px] rounded-t-3xl sm:rounded-3xl p-6 pb-5 shadow-2xl">
        <div className="mx-auto sm:hidden w-10 h-1 rounded-full bg-slate-200 mb-4" />
        <p className="text-xs font-semibold text-forest-600 mb-1">알림</p>
        <h4 className="text-lg font-bold mb-2">{popup.title}</h4>
        <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{popup.body}</p>
        {popup.link_url && (
          <a
            href={popup.link_url}
            className="mt-3 inline-block text-sm font-medium text-forest-600 hover:underline"
          >
            자세히 보기 →
          </a>
        )}
        <div className="mt-5 flex items-center justify-between text-sm">
          <button className="text-slate-400 py-2" onClick={() => close(popup.dismiss_days)}>
            {popup.dismiss_days}일 동안 보지 않기
          </button>
          <button
            className="bg-forest-600 text-white font-medium px-5 py-2 rounded-xl"
            onClick={() => close()}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
