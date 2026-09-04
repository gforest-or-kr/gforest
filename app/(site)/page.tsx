import Link from "next/link";
import { Suspense } from "react";
import { withUser, many, type DbClient } from "@/lib/db";
import { publicMediaUrl } from "@/lib/storage";
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

// 게시판 최신 글 — 호출자의 RLS 컨텍스트(공개 위젯=anon, 회원 위젯=사용자)를 따른다
async function latestPosts(c: DbClient, boardSlug: string, limit: number) {
  return many<WidgetPost>(
    c,
    `select p.id, p.title, to_json(p.created_at)#>>'{}' as created_at, p.event_date::text as event_date,
       json_build_object('slug', b.slug) as boards
     from posts p join boards b on b.id = p.board_id
     where b.slug = $1 and p.deleted_at is null
     order by p.created_at desc limit $2`,
    [boardSlug, limit],
  );
}

function PostList({ posts, slug, empty }: { posts: WidgetPost[]; slug: string; empty: string }) {
  if (posts.length === 0)
    return <p className="py-6 text-sm text-slate-400 text-center">{empty}</p>;
  return (
    <ul className="divide-y divide-slate-50">
      {posts.map((p) => (
        <li key={p.id} className="py-2.5 flex justify-between gap-3">
          {/* min-w-0: flex 자식은 기본 min-width:auto라 긴 제목이 안 줄어들어 칼럼을 넓힌다 → truncate가 듣게 한다 */}
          <Link href={`/boards/${slug}/${p.id}`} className="min-w-0 truncate hover:text-forest-700">
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
    // min-w-0: 그리드 칼럼이 내부 콘텐츠 때문에 늘어나지 않게 (긴 제목 대비)
    <div className="min-w-0 rounded-3xl border border-slate-100 p-5 sm:p-6">
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

// ②③ 공지 + 일정 (공개 게시판 — anon 컨텍스트)
async function NewsWidgets() {
  const { notices, events } = await withUser(null, async (c) => {
    const notices = await latestPosts(c, "notice", 4);
    const events = await many<WidgetPost>(
      c,
      `select p.id, p.title, to_json(p.created_at)#>>'{}' as created_at, p.event_date::text as event_date,
         json_build_object('slug', b.slug) as boards
       from posts p join boards b on b.id = p.board_id
       where b.slug = 'calendar' and p.deleted_at is null and p.event_date >= $1::date
       order by p.event_date asc limit 4`,
      [new Date().toISOString().slice(0, 10)],
    );
    return { notices, events };
  });

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
                  <Link href={`/boards/calendar/${e.id}`} className="min-w-0 hover:text-forest-700 truncate">
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
  const { stories, exchanges } = await withUser(null, async (c) => {
    const stories = await latestPosts(c, "story", 3);
    const exchanges = await latestPosts(c, "exchange", 3);
    return { stories, exchanges };
  });
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

// ②' 회원 위젯 — 로그인(승인) 회원에게만. 회원 게시판이라 사용자 RLS 컨텍스트로 읽는다.
async function MemberWidget() {
  const profile = await getSessionProfile();
  if (!profile || profile.role === "pending") return null;

  const [free, parents] = await withUser(profile.id, async (c) => [
    await latestPosts(c, "free", 3),
    await latestPosts(c, "parents", 3),
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
          <ul key={slug} className="min-w-0 divide-y divide-forest-100/60">
            {memberPosts[i].length === 0 && (
              <li className="py-2.5 text-sm text-slate-400">아직 게시글이 없습니다</li>
            )}
            {memberPosts[i].map((p) => (
              <li key={p.id} className="py-2.5 flex justify-between gap-3">
                <Link href={`/boards/${slug}/${p.id}`} className="min-w-0 truncate hover:text-forest-700">
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

// 팝업 — 공개 읽기(popups_select), 노출 기간 안의 활성 팝업만
async function Popups() {
  const popups = await withUser(null, (c) =>
    many<{ id: string; title: string; body: string; link_url: string | null; dismiss_days: number }>(
      c,
      `select id, title, body, link_url, dismiss_days from popups
       where is_active = true and starts_at <= now() and ends_at >= now()
       order by sort_order`,
    ),
  );
  return <PopupLayer popups={popups} />;
}

// ① 히어로 — 활성 슬라이드가 있으면 슬라이더, 없으면 정적 폴백
async function Hero() {
  const rows = await withUser(null, (c) =>
    many<{
      id: string;
      title: string;
      subtitle: string | null;
      link_url: string | null;
      image_desktop_path: string;
      image_mobile_path: string;
    }>(
      c,
      `select id, title, subtitle, link_url, image_desktop_path, image_mobile_path
       from slides where is_active = true order by sort_order`,
    ),
  );

  // 슬라이드 이미지는 공개 미디어(site/) — CloudFront 경로(없으면 서명 URL)
  const slides: Slide[] = await Promise.all(
    rows.map(async (s) => ({
      id: s.id,
      title: s.title,
      subtitle: s.subtitle,
      link_url: s.link_url,
      desktopUrl: (await publicMediaUrl("site", s.image_desktop_path)) ?? "",
      mobileUrl: (await publicMediaUrl("site", s.image_mobile_path)) ?? "",
    })),
  );

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
