"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

// SCR-302 학교일정표 — 월 그리드(모바일 도트 / 데스크탑 칩) + 선택일 상세.
// 일정 데이터는 posts.event_date('YYYY-MM-DD'). 학교 일정은 소수라 전체를 받아 월 이동은 클라에서.
type Ev = { id: string; title: string; date: string };

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const key = (y: number, m: number, d: number) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export default function CalendarView({ events, slug }: { events: Ev[]; slug: string }) {
  const today = new Date();
  const todayKey = key(today.getFullYear(), today.getMonth(), today.getDate());
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(todayKey);

  const byDate = useMemo(() => {
    const map: Record<string, Ev[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  // 6주(42칸) 그리드 — 1일이 속한 주의 일요일부터
  const cells = useMemo(() => {
    const startDay = new Date(cur.y, cur.m, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(cur.y, cur.m, 1 - startDay + i);
      return {
        d: dt.getDate(),
        inMonth: dt.getMonth() === cur.m,
        key: key(dt.getFullYear(), dt.getMonth(), dt.getDate()),
      };
    });
  }, [cur]);

  const move = (delta: number) =>
    setCur((c) => {
      const dt = new Date(c.y, c.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });

  const selEvents = byDate[sel] ?? [];

  return (
    <div>
      {/* 헤더: 월 이동 + 오늘 */}
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

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
        {cells.map((c) => {
          const evs = byDate[c.key] ?? [];
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
              {evs.length > 0 && (
                <>
                  {/* 모바일: 도트 */}
                  <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-forest-500" />
                  {/* 데스크탑: 일정 칩 */}
                  <div className="hidden sm:flex flex-col gap-0.5 w-full min-w-0">
                    {evs.slice(0, 2).map((e) => (
                      <span key={e.id} className="truncate text-[11px] leading-tight bg-forest-50 text-forest-700 rounded px-1 py-0.5">{e.title}</span>
                    ))}
                    {evs.length > 2 && <span className="text-[11px] text-slate-400 px-1">+{evs.length - 2}</span>}
                  </div>
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* 선택일 상세 */}
      <div className="mt-5">
        <h3 className="font-bold mb-2">
          {Number(sel.slice(5, 7))}월 {Number(sel.slice(8, 10))}일 일정
        </h3>
        {selEvents.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">일정이 없습니다</p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {selEvents.map((e) => (
              <li key={e.id}>
                <Link href={`/boards/${slug}/${e.id}`} className="block py-3 hover:text-forest-700 truncate">{e.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
