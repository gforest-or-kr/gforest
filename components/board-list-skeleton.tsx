// 목록 영역 스켈레톤 — Suspense fallback. 실제 카드(제목줄 + 메타줄)와 높이를 맞춰
// 데이터로 교체될 때 레이아웃 점프를 최소화한다. 헤더 셸은 정적이라 여기 포함하지 않는다.
export default function BoardListSkeleton() {
  return (
    <ul className="divide-y divide-slate-50">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="py-3.5 animate-pulse">
          <div className="h-4 rounded bg-slate-100" style={{ width: `${88 - (i % 4) * 12}%` }} />
          <div className="mt-2 h-3 w-40 rounded bg-slate-50" />
        </li>
      ))}
    </ul>
  );
}
