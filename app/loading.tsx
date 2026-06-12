// 루트 전환 스켈레톤 — 메인 진입 즉시 피드백 (GFM-30)
export default function RootLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <div className="mt-4 rounded-3xl bg-gradient-to-br from-forest-600 to-forest-900 aspect-[16/9] sm:aspect-[16/6] animate-pulse" />
      <div className="mt-6 grid lg:grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-3xl border border-slate-100 p-6 animate-pulse">
            <div className="h-5 w-28 rounded bg-slate-100 mb-4" />
            {[0, 1, 2].map((j) => (
              <div key={j} className="h-4 rounded bg-slate-50 my-3" style={{ width: `${85 - j * 12}%` }} />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}
