import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBoardMeta, getPublicBoardSlugs, getCalendarEvents } from "@/lib/boards";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import WriteButton from "@/components/write-button";
import BoardList from "@/components/board-list";
import BoardListSkeleton from "@/components/board-list-skeleton";
import CalendarView from "@/components/calendar-view";
import ReservationCalendar from "@/components/reservation-calendar";
import AccessNotice from "@/components/access-notice";

// 공개 게시판은 정적 프리렌더(prefetch 작동). 권한 게시판은 목록에서 쿠키를 읽어 동적 렌더된다.
export async function generateStaticParams() {
  const slugs = await getPublicBoardSlugs();
  return slugs.map((slug) => ({ slug }));
}

// 회원 게시판 목록은 noindex(누설 방지, GFM-58). getBoardMeta는 쿠키를 안 읽어 정적 유지.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const board = await getBoardMeta(slug);
  if (!board) return {};
  return board.read_roles !== null
    ? { title: board.name, robots: { index: false, follow: false } }
    : { title: board.name };
}

type Params = { slug: string };
type SearchParams = { page?: string; q?: string };

// 셸(헤더/제목/검색/글쓰기)은 쿠키를 읽지 않아 정적이다. 개인화(글쓰기 버튼)는 클라이언트
// (WriteButton)로, 데이터 목록은 Suspense 안(BoardList)에서 스트리밍한다 — 클릭 시 셸이
// prefetch로 즉시 뜨고 목록만 채워지므로 "딜레이 후 이동"이 "즉시 셸 + 목록 채움"이 된다.
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const board = await getBoardMeta(slug);
  if (!board) notFound();

  // 캘린더형 게시판은 목록 대신 월 달력(SCR-302)으로 렌더. 공개 데이터라 쿠키 미사용 → ISR 안전.
  if (board.board_type === "calendar") {
    const events = await getCalendarEvents(slug);
    return (
      <main className="max-w-4xl mx-auto px-4 pb-24">
        <div className="mt-6 mb-4">
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <CalendarView events={events} slug={slug} />
        <WriteButton slug={slug} writeRoles={board.write_roles} variant="fab" />
      </main>
    );
  }

  // 공간사용예약(SCR-303)도 달력으로. 회원 전용이라 세션(RLS)으로 읽는다 → 동적 렌더.
  if (board.board_type === "reservation") {
    const profile = await getSessionProfile();
    if (!canReadBoard(board.read_roles, profile?.role ?? null)) {
      return (
        <main className="max-w-4xl mx-auto px-4">
          <AccessNotice boardName={board.name} readRoles={board.read_roles ?? []} loggedIn={!!profile} returnTo={`/boards/${slug}`} />
        </main>
      );
    }
    const supabase = await createClient();
    const [{ data: rows }, { data: spaces }] = await Promise.all([
      supabase
        .from("posts")
        .select("id, title, event_start, event_end, space_id, spaces(name, color), author:profiles(nickname), boards!inner(slug)")
        .eq("boards.slug", slug)
        .is("deleted_at", null)
        .not("event_start", "is", null)
        .order("event_start", { ascending: true }),
      supabase.from("spaces").select("id, name, color").eq("is_active", true).order("sort_order"),
    ]);
    const reservations = (rows ?? []).map((r) => {
      const sp = r.spaces as { name: string; color: string } | null;
      const au = r.author as { nickname: string } | null;
      return {
        id: r.id as string,
        title: r.title as string,
        start: r.event_start as string,
        end: (r.event_end as string | null) ?? null,
        spaceId: (r.space_id as string | null) ?? null,
        spaceName: sp?.name ?? null,
        spaceColor: sp?.color ?? null,
        nickname: au?.nickname ?? null,
      };
    });
    const canWrite = !!profile && (profile.role === "admin" || board.write_roles.includes(profile.role));
    return (
      <main className="max-w-4xl mx-auto px-4 pb-24">
        <div className="mt-6 mb-4">
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <ReservationCalendar reservations={reservations} spaces={spaces ?? []} slug={slug} canWrite={canWrite} />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      {/* 정적 셸 */}
      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <form className="flex items-center gap-2" action={`/boards/${slug}`}>
            <input
              name="q"
              className="border border-slate-200 rounded-xl text-sm px-3 py-2 w-36 sm:w-56"
              placeholder="제목+내용 검색"
            />
          </form>
          <WriteButton slug={slug} writeRoles={board.write_roles} variant="header" />
        </div>
      </div>

      {/* 동적 목록 — Suspense 스트리밍 (정밀 스켈레톤 fallback) */}
      <Suspense fallback={<BoardListSkeleton />}>
        <BoardList slug={slug} board={board} searchParams={searchParams} />
      </Suspense>

      <WriteButton slug={slug} writeRoles={board.write_roles} variant="fab" />
    </main>
  );
}
