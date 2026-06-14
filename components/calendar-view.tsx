"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";

// SCR-302 학교일정표 — 월 그리드(모바일 도트 / 데스크탑 칩) + 달력 아래 '이달 전체 일정 목록'.
// 모바일에선 도트만으로 일정 파악이 어려워, 월 목록에서 제목을 읽고 날짜 탭 시 해당 그룹으로 스크롤한다.
type Ev = { id: string; title: string; date: string };

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
const cellKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
function dateLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return `${m}월 ${d}일 (${WD[new Date(y, m - 1, d).getDay()]})`;
}

export default function CalendarView({ events, slug }: { events: Ev[]; slug: string }) {
  const today = new Date();
  const todayKey = cellKey(today.getFullYear(), today.getMonth(), today.getDate());
  const [cur, setCur] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [sel, setSel] = useState(todayKey);
  const dayRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const byDate = useMemo(() => {
    const map: Record<string, Ev[]> = {};
    for (const e of events) (map[e.date] ??= []).push(e);
    return map;
  }, [events]);

  const cells = useMemo(() => {
    const startDay = new Date(cur.y, cur.m, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(cur.y, cur.m, 1 - startDay + i);
      return { d: dt.getDate(), inMonth: dt.getMonth() === cur.m, key: cellKey(dt.getFullYear(), dt.getMonth(), dt.getDate()) };
    });
  }, [cur]);

  // 이달 일정 — 날짜별 그룹(시간순)
  const monthGroups = useMemo(() => {
    const prefix = `${cur.y}-${pad(cur.m + 1)}-`;
    const inMonth = events.filter((e) => e.date.startsWith(prefix)).sort((a, b) => a.date.localeCompare(b.date));
    const groups: { date: string; items: Ev[] }[] = [];
    for (const e of inMonth) {
      const last = groups[groups.length - 1];
      if (last && last.date === e.date) last.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    }
    return groups;
  }, [events, cur]);

  const move = (delta: number) =>
    setCur((c) => {
      const dt = new Date(c.y, c.m + delta, 1);
      return { y: dt.getFullYear(), m: dt.getMonth() };
    });

  const selectDay = (key: string) => {
    setSel(key);
    requestAnimationFrame(() => dayRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

  return (
    <div>
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

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-2xl overflow-hidden border border-slate-100">
        {cells.map((c) => {
          const evs = byDate[c.key] ?? [];
          const isSel = c.key === sel;
          const isToday = c.key === todayKey;
          return (
            <button
              key={c.key}
              onClick={() => selectDay(c.key)}
              className={`min-h-[46px] sm:min-h-[92px] bg-white p-1 sm:p-1.5 flex flex-col items-center sm:items-stretch gap-1 ${c.inMonth ? "" : "bg-slate-50/50"} ${isSel ? "ring-2 ring-forest-500 ring-inset" : ""}`}
            >
              <span className={`text-xs sm:text-sm grid place-items-center w-6 h-6 rounded-full sm:self-start ${isToday ? "bg-forest-600 text-white font-bold" : c.inMonth ? "text-slate-700" : "text-slate-300"}`}>
                {c.d}
              </span>
              {evs.length > 0 && (
                <>
                  <span className="sm:hidden flex items-center gap-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-forest-500" />
                    {evs.length > 1 && <span className="text-[10px] text-forest-600 font-semibold leading-none">{evs.length}</span>}
                  </span>
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

      {/* 이달 전체 일정 목록 */}
      <div className="mt-6">
        <h3 className="font-bold mb-3">{cur.m + 1}월 전체 일정</h3>
        {monthGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">이달은 등록된 일정이 없습니다</p>
        ) : (
          <div className="space-y-1">
            {monthGroups.map((g) => (
              <div
                key={g.date}
                ref={(el) => { dayRefs.current[g.date] = el; }}
                className={`rounded-2xl px-2 py-1.5 ${g.date === sel ? "bg-forest-50" : ""}`}
              >
                <p className="text-sm font-semibold text-slate-500 px-1 flex items-center gap-2">
                  {dateLabel(g.date)}
                  {g.date === todayKey && <span className="text-[11px] font-bold bg-forest-600 text-white rounded-full px-2 py-0.5">오늘</span>}
                </p>
                <ul className="mt-0.5">
                  {g.items.map((e) => (
                    <li key={e.id}>
                      <Link href={`/boards/${slug}/${e.id}`} className="flex items-start gap-2 py-2 px-1 hover:text-forest-700">
                        <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-forest-500 shrink-0" />
                        <span className="min-w-0">{e.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
