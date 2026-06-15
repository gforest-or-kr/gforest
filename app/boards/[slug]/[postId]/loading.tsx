// 글 상세 전환 즉시 피드백 — 동적 렌더라 prefetch 시 이 스켈레톤이 먼저 뜬다
export default function PostLoading() {
  return (
    <main className="max-w-3xl mx-auto px-4 pb-24 animate-pulse">
      <div className="mt-6 mb-4 h-4 w-24 rounded bg-slate-100" />
      <div className="h-7 w-3/4 rounded bg-slate-100" />
      <div className="mt-3 h-3.5 w-48 rounded bg-slate-50" />
      <div className="mt-8 pt-6 border-t border-slate-100 space-y-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 rounded bg-slate-50" style={{ width: `${95 - (i % 3) * 15}%` }} />
        ))}
      </div>
    </main>
  );
}
