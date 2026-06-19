import type { Metadata } from "next";
import SiteHeader from "./_components/site-header";
import Reveal from "./_components/reveal";

export const metadata: Metadata = {
  title: "시안 A · Modern Minimal — 푸른숲발도르프학교 (프로토타입)",
};

// ── 시안 A(Modern Minimal) 프로토타입 ──────────────────────────────────────
// 정적 페이지. 쿠키·세션·DB를 호출하지 않는다(렌더링 함정 #9 회피). 콘텐츠는 목업과 동일한
// 더미 샘플이며, 사진은 forest→teal 그라데이션 플레이스홀더로 대체했다(외부 의존 0).

const PALETTE = {
  forest: "#1F5C46",
  forestDeep: "#163D2F",
  ink: "#1A2421",
  muted: "#5B6B63",
  line: "#E4EAE6",
  bgSoft: "#F4F7F4",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-teal-600 font-semibold text-sm tracking-wide mb-3">
      {children}
    </p>
  );
}

const COURSES = [
  { t: "담임과정", d: "1–8학년. 한 담임이 8년간 함께하며 에포크 수업으로 깊이 배운다." },
  { t: "상급과정", d: "9–12학년. 사고의 독립과 전문성, 농사실습·인턴십·프로젝트." },
  { t: "절기와 공동체 행사", d: "미카엘·성마틴·빛의 축제 등 사계절 절기를 온 학교가 함께 준비한다." },
  { t: "예술·노작·음악", d: "오이리트미·목공·뜨개·오케스트라 — 손과 의지를 깨우는 노작." },
];

const NOTICES = [
  { d: "2026.06.09", t: "2026학년도 수시 편입학 전형 안내 (1~11학년)" },
  { d: "2026.06.02", t: "여름 절기 · 하지 마당 공개 초대" },
  { d: "2026.05.28", t: "상급 오케스트라 정기연주회 안내" },
  { d: "2026.05.20", t: "살림살이 공개 총회 일정 공지" },
];

const EVENTS = [
  { m: "06", day: "21", w: "일", t: "여름 절기 · 하지 마당" },
  { m: "06", day: "27", w: "토", t: "온라인 입학설명회" },
  { m: "07", day: "04", w: "토", t: "상급 오케스트라 정기연주회" },
  { m: "07", day: "18", w: "토", t: "미카엘 추수 축제 준비 모임" },
];

const DEVELOP = [
  { age: "0–7세", title: "손", body: "모방과 리듬으로 자라는 시기. 글자·숫자를 일찍 가르치지 않고 의지를 키운다." },
  { age: "7–14세", title: "가슴", body: "상상력과 예술로 세계를 느끼는 시기. 담임과 함께 에포크로 깊이 배운다." },
  { age: "14–21세", title: "머리", body: "독립적 사고와 판단의 시기. 탐구·실습·프로젝트로 세상과 만난다." },
];

export default function DesignAPreview() {
  return (
    <main id="top" className="bg-white text-[#1A2421]" style={{ color: PALETTE.ink }}>
      <SiteHeader />

      {/* HERO */}
      <section className="relative">
        <div className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(120% 120% at 80% 0%, ${PALETTE.forest} 0%, ${PALETTE.forestDeep} 55%, #0e2c21 100%)`,
            }}
          />
          <div className="absolute inset-0 opacity-25 bg-[radial-gradient(circle_at_20%_80%,rgba(79,179,160,.55),transparent_45%)]" />
          <div className="relative mx-auto max-w-[1180px] px-5 py-24 sm:py-32 text-white">
            <Reveal>
              <p className="text-teal-200 font-semibold mb-4">
                푸른숲발도르프학교 · 개교 22년
              </p>
              <h1 className="text-3xl sm:text-5xl font-bold leading-[1.18] tracking-tight max-w-3xl">
                자연 속에서, 함께 배우고,
                <br />
                스스로 자라는 행복한 학교
              </h1>
              <p className="mt-6 text-white/80 text-lg max-w-xl leading-relaxed">
                루돌프 슈타이너의 발달관 위에서, 머리와 가슴과 손이 고르게 자라는
                12년의 여정을 학부모와 교사가 함께 만들어 갑니다.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a
                  href="#admit"
                  className="inline-flex items-center rounded-full bg-teal-400 px-6 py-3 font-semibold text-[#0e2c21] hover:bg-teal-300 transition-colors"
                >
                  입학설명회 신청 →
                </a>
                <a
                  href="#about"
                  className="inline-flex items-center rounded-full bg-white/12 backdrop-blur px-6 py-3 font-semibold text-white ring-1 ring-white/25 hover:bg-white/20 transition-colors"
                >
                  학교 소개 보기
                </a>
              </div>
              <div className="mt-10 flex flex-wrap gap-2.5">
                {["개교 22년", "담임·상급 완전 12년 과정", "병설 어린이집·유아과정"].map(
                  (c) => (
                    <span
                      key={c}
                      className="rounded-full bg-white/10 ring-1 ring-white/20 px-4 py-1.5 text-sm text-white/90"
                    >
                      {c}
                    </span>
                  ),
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ABOUT — 7년 주기 발달 */}
      <section id="about" className="mx-auto max-w-[1180px] px-5 py-20 sm:py-28">
        <Reveal>
          <Eyebrow>발도르프 교육철학</Eyebrow>
          <h2 className="text-2xl sm:text-4xl font-bold tracking-tight max-w-2xl leading-snug">
            머리와 가슴과 손이 자라는 시간, 유아기부터
          </h2>
          <p className="mt-5 text-[#5B6B63] text-lg max-w-2xl leading-relaxed">
            루돌프 슈타이너의 발달관은 인간을 7년 단위로 바라봅니다. 푸른숲은 각
            시기에 맞는 배움으로, 아이가 스스로 자랄 힘을 기릅니다.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-3">
          {DEVELOP.map((d, i) => (
            <Reveal key={d.title} delay={i * 120}>
              <div className="h-full rounded-[18px] border border-[#E4EAE6] bg-[#F4F7F4] p-7">
                <div className="flex items-center gap-3">
                  <span className="grid place-items-center w-11 h-11 rounded-2xl bg-teal-500 text-white text-lg font-bold">
                    {d.title}
                  </span>
                  <span className="text-sm font-semibold text-teal-700">
                    {d.age}
                  </span>
                </div>
                <p className="mt-4 text-[#1A2421] leading-relaxed">{d.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* COURSES */}
      <section id="courses" style={{ background: PALETTE.bgSoft }}>
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:py-28">
          <Reveal>
            <Eyebrow>교육과정 · 푸른숲의 흐름</Eyebrow>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              하루의 리듬에서 12년의 여정까지
            </h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {COURSES.map((c, i) => (
              <Reveal key={c.t} delay={i * 100}>
                <div className="group h-full rounded-[18px] bg-white border border-[#E4EAE6] p-7 hover:shadow-[0_18px_50px_-24px_rgba(22,61,47,.45)] transition-shadow">
                  <div
                    className="h-32 rounded-xl mb-5"
                    style={{
                      background: `linear-gradient(135deg, ${PALETTE.forest}, #2C8C7C)`,
                    }}
                  />
                  <h3 className="text-xl font-bold">{c.t}</h3>
                  <p className="mt-2 text-[#5B6B63] leading-relaxed">{c.d}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* BAND — 학부모 공동체 */}
      <section
        className="text-white"
        style={{
          background: `linear-gradient(135deg, ${PALETTE.forestDeep}, ${PALETTE.forest})`,
        }}
      >
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:py-24">
          <Reveal>
            <p className="text-teal-200 font-semibold mb-3">학부모 공동체</p>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight max-w-3xl leading-snug">
              학교가 곧 마을이고, 마을이 학교입니다
            </h2>
            <p className="mt-5 text-white/80 text-lg max-w-2xl leading-relaxed">
              학부모는 학교 예산·운영 방향을 교사·행정실과 함께 논의하고, 매년
              살림살이(재정)를 전체 공개합니다. 절기 축제도 함께 준비합니다.
            </p>
          </Reveal>
        </div>
      </section>

      {/* NEWS + SCHEDULE */}
      <section id="news" className="mx-auto max-w-[1180px] px-5 py-20 sm:py-28">
        <div className="grid gap-12 lg:grid-cols-2">
          <Reveal>
            <Eyebrow>학교소식</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-7">
              알려드립니다
            </h2>
            <ul className="divide-y divide-[#E4EAE6]">
              {NOTICES.map((n) => (
                <li key={n.t} className="py-4 flex gap-4">
                  <span className="text-sm text-teal-700 font-semibold shrink-0 w-[84px]">
                    {n.d}
                  </span>
                  <a href="#" className="hover:text-teal-600 transition-colors">
                    {n.t}
                  </a>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={120}>
            <Eyebrow>학사일정</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-7">
              다가오는 일정
            </h2>
            <ul className="space-y-3">
              {EVENTS.map((e) => (
                <li
                  key={e.t}
                  className="flex items-center gap-4 rounded-2xl border border-[#E4EAE6] p-3.5"
                >
                  <span className="grid place-items-center w-14 h-14 shrink-0 rounded-xl bg-teal-50 text-teal-700">
                    <span className="text-[11px] leading-none">{e.m}월</span>
                    <span className="text-lg font-bold leading-tight">
                      {e.day}
                    </span>
                    <span className="text-[11px] leading-none">{e.w}</span>
                  </span>
                  <span className="font-medium">{e.t}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* KINDERGARTEN */}
      <section id="kindergarten" style={{ background: PALETTE.bgSoft }}>
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:py-24 grid gap-10 lg:grid-cols-2 items-center">
          <Reveal>
            <div
              className="aspect-[4/3] rounded-[18px]"
              style={{
                background: `linear-gradient(135deg, #4FB3A0, ${PALETTE.forest})`,
              }}
            />
          </Reveal>
          <Reveal delay={120}>
            <Eyebrow>병설어린이집 · 유아과정</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug">
              세상에서 가장 아름다운 시간, 유아기
            </h2>
            <p className="mt-5 text-[#5B6B63] text-lg leading-relaxed">
              계절 동화와 손 인형극으로 이야기 상상력을 키우고, 밀랍·뜨개·빵 굽기로
              손과 의지를 깨웁니다. 글자와 숫자를 일찍 가르치지 않습니다.
            </p>
            <a
              href="#"
              className="mt-7 inline-flex items-center font-semibold text-teal-700 hover:text-teal-600"
            >
              유아과정 안내 →
            </a>
          </Reveal>
        </div>
      </section>

      {/* ADMIT */}
      <section id="admit" className="mx-auto max-w-[1180px] px-5 py-20 sm:py-28">
        <Reveal>
          <div className="rounded-[24px] border border-teal-200 bg-teal-50 p-9 sm:p-14 text-center">
            <Eyebrow>입학 안내</Eyebrow>
            <h2 className="text-2xl sm:text-4xl font-bold tracking-tight">
              수시 편입학 안내
            </h2>
            <p className="mt-4 text-[#5B6B63] text-lg max-w-xl mx-auto leading-relaxed">
              1~11학년 수시 편입학 전형을 안내합니다. 온라인 입학설명회에서 교육과정과
              전형 절차·학비를 자세히 들으실 수 있습니다.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a
                href="#"
                className="inline-flex items-center rounded-full bg-teal-500 px-6 py-3 font-semibold text-white hover:bg-teal-600 transition-colors"
              >
                온라인 입학설명회 신청
              </a>
              <a
                href="#"
                className="inline-flex items-center rounded-full bg-white px-6 py-3 font-semibold text-teal-700 ring-1 ring-teal-200 hover:bg-teal-100 transition-colors"
              >
                전형 절차 · 학비 안내
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* MEDIA STRIP */}
      <section id="gallery" style={{ background: PALETTE.bgSoft }}>
        <div className="mx-auto max-w-[1180px] px-5 py-20 sm:py-24">
          <Reveal>
            <Eyebrow>영상으로 보는 푸른숲</Eyebrow>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-10">
              학교의 하루와 사계절
            </h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              "봄 축제 후기 — 온 학교가 함께한 하루",
              "상급과정 농사실습 다큐",
              "겨울 빛의 축제 스케치",
              "계절 동화와 손 인형극",
            ].map((t, i) => (
              <Reveal key={t} delay={i * 90}>
                <div className="group">
                  <div
                    className="relative aspect-video rounded-xl overflow-hidden grid place-items-center"
                    style={{
                      background: `linear-gradient(135deg, ${PALETTE.forest}, #2C8C7C)`,
                    }}
                  >
                    <span className="grid place-items-center w-14 h-14 rounded-full bg-white/90 text-teal-700 text-xl pl-1 group-hover:scale-105 transition-transform">
                      ▶
                    </span>
                  </div>
                  <p className="mt-3 font-medium text-[#1A2421] leading-snug">
                    {t}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer
        className="text-white/80"
        style={{ background: PALETTE.forestDeep }}
      >
        <div className="mx-auto max-w-[1180px] px-5 py-14">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">
            <div>
              <div className="flex items-center gap-2 text-white">
                <span className="grid place-items-center w-9 h-9 rounded-xl bg-teal-500 font-bold">
                  숲
                </span>
                <span className="font-bold">푸른숲발도르프학교</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed">
                경기도 광주시 퇴촌면 산수로 870-87 (원당리 348-19)
                <br />
                031-793-6591
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
              {["학교소개", "교육과정", "학교소식", "학사일정", "입학안내", "오시는길"].map(
                (m) => (
                  <a key={m} href="#" className="hover:text-white transition-colors">
                    {m}
                  </a>
                ),
              )}
            </nav>
          </div>
          <p className="mt-10 text-xs text-white/50">
            © 푸른숲발도르프학교 · 디자인 시안 A(Modern Minimal) 프로토타입 — 평가용
          </p>
        </div>
      </footer>
    </main>
  );
}
