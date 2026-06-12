// 게시판 목록 스켈레톤 — 내비게이션 즉시 피드백 (GFM-29)
export default function BoardLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      <div className="mt-6 mb-4">
        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
        <div className="mt-2 h-7 w-44 rounded bg-slate-100 animate-pulse" />
      </div>
      <ul className="divide-y divide-slate-50">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="py-4 animate-pulse">
            <div className="h-4 rounded bg-slate-100" style={{ width: `${88 - (i % 4) * 12}%` }} />
            <div className="mt-2 h-3 w-40 rounded bg-slate-50" />
          </li>
        ))}
      </ul>
    </main>
  );
}
