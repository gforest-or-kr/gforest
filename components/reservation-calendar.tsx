"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// SCR-303 공간사용예약 — 공간 필터 + 월 달력(공간색 도트/칩) + 선택일 예약 현황 + 예약하기.
// 예약 = posts(space_id, event_start, event_end). 시각은 KST로 표시한다.
type Rsv = {
  id: string;
  title: string;
  start: string; // ISO timestamptz
  end: string | null;
  spaceId: string | null;
  spaceName: string | null;
  spaceColor: string | null;
  nickname: string | null;
};
type Space = { id: string; name: string; color: string };

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const cellKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const KST = "Asia/Seoul";
const dateKST = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: KST }); // YYYY-MM-DD
const timeKST = (iso: string) =>
  new Date(iso).toLocaleTimeString("ko-KR", { timeZone: KST, hour: "2-digit", minute: "2-digit", hour12: false });

export default function ReservationCalendar({
  reservations,
  spaces,
  slug,
  canWrite,
}: {
  reservations: Rsv[];
  spaces: Space[];
  slug: string;
  canWrite: boolean;
}) {
  const today = new Date();
  const todayKey = today.toLocaleDateString("en-CA", { timeZone: KST });
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(todayKey);
  const [space, setSpace] = useState<string | null>(null); // null = 전체

  const filtered = useMemo(
    () => (space ? reservations.filter((r) => r.spaceId === space) : reservations),
    [reservations, space],
  );

  const byDate = useMemo(() => {
    const map: Record<string, Rsv[]> = {};
    for (const r of filtered) (map[dateKST(r.start)] ??= []).push(r);
    for (const k in map) map[k].sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [filtered]);

  const cells = useMemo(() => {
    const startDay = new Date(cur.y, cur.m, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(cur.y, cur.m, 1 - startDay + i);
      return { d: dt.getDate(), inMonth: dt.getMonth() === cur.m, key: cellKey(dt.getFullYear(), dt.getMonth(), dt.getDate()) };
    });
  }, [cur]);

  const move = (delta: number) =>
    setCur((c) => {
      const dt = new Date(c.y, c.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });

  const selRsvs = byDate[sel] ?? [];
  // 선택일의 공간별 색 도트(중복 공간 제거)
  const dotsOf = (k: string) => {
    const seen = new Map<string, string>();
    for (const r of byDate[k] ?? []) if (r.spaceId) seen.set(r.spaceId, r.spaceColor ?? "#2f9e6e");
    return [...seen.values()].slice(0, 4);
  };

  return (
    <div>
      {/* 공간 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-2 [scrollbar-width:none]">
        <button
          onClick={() => setSpace(null)}
          className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border ${space === null ? "bg-forest-600 border-forest-600 text-white" : "border-slate-200 text-slate-600"}`}
        >
          전체
        </button>
        {spaces.map((s) => (
          <button
            key={s.id}
            onClick={() => setSpace(s.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium border flex items-center gap-1.5 ${space === s.id ? "border-transparent text-white" : "border-slate-200 text-slate-600"}`}
            style={space === s.id ? { backgroundColor: s.color } : undefined}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
            {s.name}
          </button>
        ))}
      </div>

      {/* 월 이동 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1">
          <button onClick={() => move(-1)} aria-label="이전 달" className="w-11 h-11 grid place-items-center rounded-xl hover:bg-slate-50 text-slate-500">◀</button>
          <h2 className="text-lg font-bold w-28 text-center tabular-nums">{cur.y}년 {cur.m + 1}월</h2>
          <button onClick={() => move(1)} aria-label="다음 달" className="w-11 h-11 grid place-items-center rounded-xl hover:bg-slate-50 text-slate-500">▶</button>
        </div>
        <button
          onClick={() => { setCur({ y: today.getFullYear(), m: today.getMonth() }); setSel(todayKey); }}
          className="text-sm px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-medium"
        >
          오늘
        </button>
      </div>

      {/* 요일 */}
      <div className="grid grid-cols-7 text-center text-xs font-medium mb-1">
        {WD.map((w, i) => (
          <div key={w} className={i === 0 ? "text-rose-400" : i === 6 ? "text-sky-400" : "text-slate-400"}>{w}</div>
        ))}
      </div>

      {/* 그리드 */}
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
        {cells.map((c) => {
          const rsvs = byDate[c.key] ?? [];
          const isSel = c.key === sel;
          const isToday = c.key === todayKey;
          return (
            <button
              key={c.key}
              onClick={() => setSel(c.key)}
              className={`min-h-[46px] sm:min-h-[92px] bg-white p-1 sm:p-1.5 flex flex-col items-center sm:items-stretch gap-1 ${c.inMonth ? "" : "bg-slate-50/50"} ${isSel ? "ring-2 ring-forest-500 ring-inset" : ""}`}
            >
              <span className={`text-xs sm:text-sm grid place-items-center w-6 h-6 rounded-full sm:self-start ${isToday ? "bg-forest-600 text-white font-bold" : c.inMonth ? "text-slate-700" : "text-slate-300"}`}>
                {c.d}
              </span>
              {rsvs.length > 0 && (
                <>
                  {/* 모바일: 공간색 도트 */}
                  <span className="sm:hidden flex gap-0.5">
                    {dotsOf(c.key).map((color, i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    ))}
                  </span>
                  {/* 데스크탑: 시간+공간 칩 */}
                  <div className="hidden sm:flex flex-col gap-0.5 w-full min-w-0">
                    {rsvs.slice(0, 2).map((r) => (
                      <span key={r.id} className="truncate text-[11px] leading-tight rounded px-1 py-0.5 text-white" style={{ backgroundColor: r.spaceColor ?? "#2f9e6e" }}>
                        {timeKST(r.start)} {r.spaceName}
                      </span>
                    ))}
                    {rsvs.length > 2 && <span className="text-[11px] text-slate-400 px-1">+{rsvs.length - 2}</span>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택일 예약 현황 */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold">{Number(sel.slice(5, 7))}월 {Number(sel.slice(8, 10))}일 예약</h3>
          {canWrite && (
            <Link href={`/boards/${slug}/write?date=${sel}`} className="text-sm font-medium text-forest-600 hover:text-forest-700">
              + 예약하기
            </Link>
          )}
        </div>
        {selRsvs.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">예약이 없습니다</p>
        ) : (
          <ul className="space-y-2">
            {selRsvs.map((r) => (
              <li key={r.id}>
                <Link href={`/boards/${slug}/${r.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 p-3 hover:bg-slate-50">
                  <span className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: r.spaceColor ?? "#2f9e6e" }} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold tabular-nums">
                      {timeKST(r.start)}{r.end ? `~${timeKST(r.end)}` : ""}
                      <span className="ml-2 font-medium" style={{ color: r.spaceColor ?? undefined }}>{r.spaceName}</span>
                    </p>
                    <p className="text-sm text-slate-600 truncate">{r.title}{r.nickname ? ` · ${r.nickname}` : ""}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
