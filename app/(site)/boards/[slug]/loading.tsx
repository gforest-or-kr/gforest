// 게시판 전환 즉시 피드백 (#29) — 실제 page 레이아웃(헤더 + 목록)과 위치·높이를 맞춰
// 데이터로 교체될 때 레이아웃 점프를 없앤다. loading.tsx가 있으면 Next가 이 스켈레톤까지
// prefetch하므로, 클릭하는 순간 즉시 표시되어 "딜레이 후 이동" 느낌이 사라진다.
export default function BoardLoading() {
  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      {/* 헤더 셸 (메뉴 그룹 + 제목) — 실제 page와 동일 위치 */}
      <div className="mt-6 mb-4">
        <div className="h-3 w-16 rounded bg-slate-100 animate-pulse" />
        <div className="mt-2 h-8 w-44 rounded bg-slate-100 animate-pulse" />
      </div>
      {/* 목록 — 모바일 카드(제목줄 + 메타줄) 높이와 일치 */}
      <ul className="divide-y divide-slate-50">
        {Array.from({ length: 8 }, (_, i) => (
          <li key={i} className="py-3.5 animate-pulse">
            <div className="h-4 rounded bg-slate-100" style={{ width: `${88 - (i % 4) * 12}%` }} />
            <div className="mt-2 h-3 w-40 rounded bg-slate-50" />
          </li>
        ))}
      </ul>
    </main>
  );
}
