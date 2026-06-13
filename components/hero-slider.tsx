"use client";

import { useEffect, useRef, useState } from "react";

export type Slide = {
  id: string;
  title: string;
  subtitle: string | null;
  link_url: string | null;
  desktopUrl: string;
  mobileUrl: string;
};

const ROLL_MS = 5000;

// SCR-100 히어로 슬라이더 — CSS scroll-snap + setInterval 자동롤링 (라이브러리 미사용)
export default function HeroSlider({ slides }: { slides: Slide[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const multi = slides.length > 1;

  // 자동롤링 — 슬라이드 2개 이상일 때만. cleanup 필수.
  useEffect(() => {
    if (!multi) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROLL_MS);
    return () => clearInterval(timer);
  }, [multi, slides.length]);

  // index → 스크롤 위치 동기화 (자동롤링·도트 클릭 공통)
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: track.clientWidth * index, behavior: "smooth" });
  }, [index]);

  // 스와이프로 위치가 바뀌면 도트 상태 동기화
  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const i = Math.round(track.scrollLeft / track.clientWidth);
    if (i !== index) setIndex(i);
  }

  if (slides.length === 0) return null;

  return (
    <section className="mt-4 relative rounded-3xl overflow-hidden bg-slate-900">
      <div
        ref={trackRef}
        onScroll={onScroll}
        style={{ scrollbarWidth: "none" }}
        className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((s, i) => {
          // 첫 슬라이드 = LCP 후보 → 우선 로드. 이후 슬라이드는 자동롤링 전까지 불필요 → 지연 (#20)
          const eager = i === 0;
          const inner = (
            <div className="relative w-full">
              {/* next/image 미도입(스펙) — 공개 URL 직접 출력 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.desktopUrl}
                alt={s.title}
                fetchPriority={eager ? "high" : undefined}
                loading={eager ? "eager" : "lazy"}
                className="hidden sm:block w-full aspect-[16/6] object-cover"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.mobileUrl}
                alt={s.title}
                fetchPriority={eager ? "high" : undefined}
                loading={eager ? "eager" : "lazy"}
                className="sm:hidden w-full aspect-[16/9] object-cover"
              />
              {(s.title || s.subtitle) && (
                <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10 bg-gradient-to-t from-black/55 to-transparent text-white">
                  {s.subtitle && (
                    <p className="text-sm font-medium text-white/80 mb-1">{s.subtitle}</p>
                  )}
                  <h2 className="text-2xl sm:text-4xl font-bold leading-snug">{s.title}</h2>
                </div>
              )}
            </div>
          );
          return (
            <div key={s.id} className="w-full shrink-0 snap-center">
              {s.link_url ? (
                <a href={s.link_url} className="block">
                  {inner}
                </a>
              ) : (
                inner
              )}
            </div>
          );
        })}
      </div>

      {multi && (
        <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              aria-label={`${i + 1}번 슬라이드로 이동`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className="grid place-items-center w-11 h-11"
            >
              <span
                className={`block rounded-full transition-all ${
                  i === index ? "w-6 h-2 bg-white" : "w-2 h-2 bg-white/50"
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
