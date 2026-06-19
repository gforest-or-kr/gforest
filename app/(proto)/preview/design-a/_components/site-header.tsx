"use client";

import { useState } from "react";

const NAV = [
  "학교소개",
  "교육과정",
  "학교소식",
  "학사일정",
  "입학안내",
  "오시는길",
];

// 시안 A 자체 헤더 — 스티키 + 모바일 햄버거. (글로벌 Header와 무관, 프로토타입 전용)
export default function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-[#E4EAE6]">
      <div className="mx-auto max-w-[1180px] px-5 h-16 flex items-center justify-between gap-4">
        <a href="#top" className="flex items-center gap-2 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-xl bg-teal-500 text-white font-bold">
            숲
          </span>
          <span className="font-bold text-[#1A2421] tracking-tight">
            푸른숲발도르프학교
          </span>
        </a>

        <nav className="hidden md:flex items-center gap-7 text-[15px] text-[#1A2421]">
          {NAV.map((m) => (
            <a key={m} href="#" className="hover:text-teal-600 transition-colors">
              {m}
            </a>
          ))}
        </nav>

        <div className="hidden md:block shrink-0">
          <a
            href="#admit"
            className="inline-flex items-center rounded-full bg-teal-500 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-600 transition-colors"
          >
            입학설명회 신청
          </a>
        </div>

        {/* 모바일 토글 */}
        <button
          type="button"
          aria-label="메뉴 열기"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden grid place-items-center w-11 h-11 -mr-2 rounded-lg text-[#1A2421]"
        >
          <span className="text-2xl leading-none">{open ? "✕" : "☰"}</span>
        </button>
      </div>

      {/* 모바일 패널 */}
      {open && (
        <div className="md:hidden border-t border-[#E4EAE6] bg-white">
          <nav className="mx-auto max-w-[1180px] px-5 py-3 flex flex-col">
            {NAV.map((m) => (
              <a
                key={m}
                href="#"
                onClick={() => setOpen(false)}
                className="py-3 text-[#1A2421] border-b border-[#F0F3F1] last:border-0"
              >
                {m}
              </a>
            ))}
            <a
              href="#admit"
              onClick={() => setOpen(false)}
              className="mt-3 mb-1 inline-flex justify-center rounded-full bg-teal-500 px-4 py-3 text-sm font-semibold text-white"
            >
              입학설명회 신청
            </a>
          </nav>
        </div>
      )}
    </header>
  );
}
