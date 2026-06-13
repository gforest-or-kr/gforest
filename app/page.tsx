import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { shortDate } from "@/lib/format";
import PopupLayer from "@/components/popup-layer-client";
import HeroSlider, { type Slide } from "@/components/hero-slider";

// 회원 위젯이 로그인 상태에 의존하므로 동적 렌더링 + Suspense 스트리밍 (GFM-29)
export const dynamic = "force-dynamic";

type WidgetPost = {
  id: string;
  title: string;
  created_at: string;
  event_date: string | null;
  boards: { slug: string } | null;
};

async function latestPosts(boardSlug: string, limit: number) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("posts")
    .select("id, title, created_at, event_date, boards!inner(slug)")
    .eq("boards.slug", boardSlug)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as WidgetPost[];
}

function PostList({ posts, slug, empty }: { posts: WidgetPost[]; slug: string; empty: string }) {
  if (posts.length === 0)
    return <p className="py-6 text-sm text-slate-400 text-center">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-50">
      {posts.map((p) => (
        <li key={p.id} className="py-2.5 flex justify-between gap-3">
          <Link href={`/boards/${slug}/${p.id}`} className="truncate hover:text-forest-700">
            {p.title}
          </Link>
          <span className="text-xs text-slate-400 shrink-0">{shortDate(p.created_at)}</span>
        </li>
      ))}
    </ul>
  );
}

function Widget({
  title,
  moreHref,
  moreLabel = "더보기 ›",
  children,
}: {
  title: string;
  moreHref: string;
  moreLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-slate-100 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-lg">{title}</h3>
        <Link className="text-sm text-forest-600 font-medium" href={moreHref}>
          {moreLabel}
        </Link>
      </div>
      {children}
    </div>
  );
}

function WidgetSkeleton({ title }: { title: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 p-5 sm:p-6">
      <h3 className="font-bold text-lg mb-3">{title}</h3>
      <div className="space-y-3 animate-pulse">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-4 rounded bg-slate-100" style={{ width: `${85 - i * 12}%` }} />
        ))}
      </div>
    </div>
  );
}

// ②③ 공지 + 일정
async function NewsWidgets() {
  const supabase = await createClient();
  const [notices, events] = await Promise.all([
    latestPosts("notice", 4),
    supabase
      .from("posts")
      .select("id, title, created_at, event_date, boards!inner(slug)")
      .eq("boards.slug", "calendar")
      .is("deleted_at", null)
      .gte("event_date", new Date().toISOString().slice(0, 10))
      .order("event_date", { ascending: true })
      .limit(4)
      .then((r) => (r.data ?? []) as WidgetPost[]),
  ]);

  return (
    <>
      <Widget title="알려드립니다" moreHref="/boards/notice">
        <PostList posts={notices} slug="notice" empty="아직 공지가 없습니다" />
      </Widget>
      <Widget title="다가오는 일정" moreHref="/boards/calendar" moreLabel="달력 보기 ›">
        {events.length === 0 ? (
          <p className="py-6 text-sm text-slate-400 text-center">예정된 일정이 없습니다</p>
        ) : (
          <ul className="space-y-2.5">
            {events.map((e) => {
              const d = new Date(e.event_date! + "T00:00:00+09:00");
              return (
                <li key={e.id} className="flex items-center gap-3">
                  <span className="w-12 shrink-0 text-center rounded-xl bg-forest-50 text-forest-700 text-xs font-bold py-1.5">
                    {d.getMonth() + 1}.{d.getDate()}
                    <br />
                    {"일월화수목금토"[d.getDay()]}
                  </span>
                  <Link href={`/boards/calendar/${e.id}`} className="hover:text-forest-700 truncate">
                    {e.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Widget>
    </>
  );
}

// ④ 최신글 (공개)
async function LatestWidgets() {
  const [stories, exchanges] = await Promise.all([
    latestPosts("story", 3),
    latestPosts("exchange", 3),
  ]);
  return (
    <>
      <Widget title="학교이야기" moreHref="/boards/story">
        <PostList posts={stories} slug="story" empty="아직 게시글이 없습니다" />
      </Widget>
      <Widget title="교류게시판" moreHref="/boards/exchange">
        <PostList posts={exchanges} slug="exchange" empty="아직 게시글이 없습니다" />
      </Widget>
    </>
  );
}

// ②' 회원 위젯 — 로그인(승인) 회원에게만
async function MemberWidget() {
  const profile = await getSessionProfile();
  if (!profile || profile.role === "pending") return null;

  const [free, parents] = await Promise.all([
    latestPosts("free", 3),
    latestPosts("parents", 3),
  ]);
  const memberPosts = [free, parents];

  return (
    <section className="mt-4 rounded-3xl bg-forest-50/70 border border-forest-100 p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-bold text-lg">우리 학교 소식</h3>
        <span className="text-[11px] font-semibold bg-forest-600 text-white rounded-full px-2 py-0.5">
          회원 전용
        </span>
      </div>
      <div className="grid sm:grid-cols-2 gap-x-8">
        {(["free", "parents"] as const).map((slug, i) => (
          <ul key={slug} className="divide-y divide-forest-100/60">
            {memberPosts[i].length === 0 && (
              <li className="py-2.5 text-sm text-slate-400">아직 게시글이 없습니다</li>
            )}
            {memberPosts[i].map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between gap-3">
                <Link href={`/boards/${slug}/${p.id}`} className="truncate hover:text-forest-700">
                  <b className="text-forest-700 font-semibold mr-1.5">
                    {slug === "free" ? "자유" : "학부모"}
                  </b>
                  {p.title}
                </Link>
                <span className="text-xs text-slate-400 shrink-0">{shortDate(p.created_at)}</span>
              </li>
            ))}
          </ul>
        ))}
      </div>
    </section>
  );
}

async function Popups() {
  const supabase = await createClient();
  const now = new Date().toISOString();
  const { data } = await supabase
    .from("popups")
    .select("id, title, body, link_url, dismiss_days")
    .eq("is_active", true)
    .lte("starts_at", now)
    .gte("ends_at", now)
    .order("sort_order");
  return <PopupLayer popups={data ?? []} />;
}

// ① 히어로 — 활성 슬라이드가 있으면 슬라이더, 없으면 정적 폴백
async function Hero() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("slides")
    .select("id, title, subtitle, link_url, image_desktop_path, image_mobile_path")
    .eq("is_active", true)
    .order("sort_order");

  const slides: Slide[] = (data ?? []).map((s) => ({
    id: s.id,
    title: s.title,
    subtitle: s.subtitle,
    link_url: s.link_url,
    desktopUrl: supabase.storage.from("site").getPublicUrl(s.image_desktop_path).data.publicUrl,
    mobileUrl: supabase.storage.from("site").getPublicUrl(s.image_mobile_path).data.publicUrl,
  }));

  if (slides.length > 0) return <HeroSlider slides={slides} />;

  // 폴백 — 활성 슬라이드 0개일 때 정적 그라데이션 히어로
  return (
    <section className="mt-4 relative rounded-3xl overflow-hidden bg-gradient-to-br from-forest-600 to-forest-900 text-white">
      <div className="aspect-[16/9] sm:aspect-[16/6] flex flex-col justify-end p-6 sm:p-10">
        <p className="text-forest-100 text-sm font-medium mb-1">푸른숲발도르프학교</p>
        <h2 className="text-2xl sm:text-4xl font-bold leading-snug">
          아이와 어른이
          <br className="sm:hidden" /> 함께 자라는 숲
        </h2>
        <Link
          href="/intro/about"
          className="mt-4 inline-flex w-fit items-center gap-1 bg-white/15 backdrop-blur px-4 py-2 rounded-full text-sm font-medium hover:bg-white/25"
        >
          학교 소개 보기 →
        </Link>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 pb-16">
      <Suspense
        fallback={
          <div className="mt-4 rounded-3xl overflow-hidden bg-slate-100 aspect-[16/9] sm:aspect-[16/6] animate-pulse" />
        }
      >
        <Hero />
      </Suspense>

      <section className="mt-6 grid lg:grid-cols-2 gap-4">
        <Suspense
          fallback={
            <>
              <WidgetSkeleton title="알려드립니다" />
              <WidgetSkeleton title="다가오는 일정" />
            </>
          }
        >
          <NewsWidgets />
        </Suspense>
      </section>

      <section className="mt-4 grid lg:grid-cols-2 gap-4">
        <Suspense
          fallback={
            <>
              <WidgetSkeleton title="학교이야기" />
              <WidgetSkeleton title="교류게시판" />
            </>
          }
        >
          <LatestWidgets />
        </Suspense>
      </section>

      <Suspense>
        <MemberWidget />
      </Suspense>

      {/* ⑤ 배너 — 정적 */}
      <section className="mt-4 grid sm:grid-cols-2 gap-3">
        <Link
          href="/intro/admission"
          className="rounded-2xl bg-slate-50 hover:bg-forest-50 border border-slate-100 p-4 text-sm font-medium flex items-center justify-between"
        >
          신입·편입 전형안내 <span className="text-forest-600">→</span>
        </Link>
        <Link
          href="/intro/location"
          className="rounded-2xl bg-slate-50 hover:bg-forest-50 border border-slate-100 p-4 text-sm font-medium flex items-center justify-between"
        >
          오시는길 <span className="text-forest-600">→</span>
        </Link>
      </section>

      <Suspense>
        <Popups />
      </Suspense>
    </main>
  );
}
