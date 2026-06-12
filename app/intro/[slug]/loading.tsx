// 정적 페이지 전환 스켈레톤 (GFM-30)
export default function IntroLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 pb-16 animate-pulse">
      <div className="lg:hidden mt-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-9 w-24 rounded-full bg-slate-100 shrink-0" />
        ))}
      </div>
      <div className="lg:flex lg:gap-10 mt-4 lg:mt-8">
        <div className="hidden lg:block w-56 shrink-0 space-y-2">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-9 rounded-xl bg-slate-50" />
          ))}
        </div>
        <div className="flex-1">
          <div className="h-7 w-64 rounded bg-slate-100" />
          <div className="mt-6 space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-4 rounded bg-slate-50" style={{ width: `${92 - i * 10}%` }} />
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
