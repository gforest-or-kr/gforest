import type { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBoardMeta, getCalendarEvents } from "@/lib/boards";
import { withUser, many } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import WriteButton from "@/components/write-button";
import BoardList from "@/components/board-list";
import BoardListSkeleton from "@/components/board-list-skeleton";
import CalendarView from "@/components/calendar-view";
import ReservationCalendar from "@/components/reservation-calendar";
import AccessNotice from "@/components/access-notice";

// 회원 게시판 목록은 noindex(누설 방지, GFM-58). getBoardMeta는 세션을 읽지 않는 캐시 페처.
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

// 게시판 페이지 — 상시 구동 서버(ECS)라 세션을 서버에서 읽어 개인화(글쓰기 버튼)까지 서버 렌더한다
// (docs/design/rendering.md 12). 공개 목록 데이터는 lib/boards.ts의 태그 캐시가 그대로 담당한다.
// 데이터 목록은 Suspense 안(BoardList)에서 스트리밍해 셸(헤더/제목/검색/글쓰기)이 먼저 뜬다.
export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const [board, profile] = await Promise.all([getBoardMeta(slug), getSessionProfile()]);
  if (!board) notFound();

  // 글쓰기 버튼 노출 — UI 제어용, 최종 차단은 posts_insert RLS(can_write_board)
  const canWrite = !!profile && (profile.role === "admin" || board.write_roles.includes(profile.role));

  // 캘린더형 게시판은 목록 대신 월 달력(SCR-302)으로 렌더. 공개 데이터라 anon 캐시 페처를 쓴다.
  if (board.board_type === "calendar") {
    const events = await getCalendarEvents(slug);
    return (
      <main className="max-w-4xl mx-auto px-4 pb-24">
        <div className="mt-6 mb-4">
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <CalendarView events={events} slug={slug} />
        <WriteButton slug={slug} canWrite={canWrite} variant="fab" />
      </main>
    );
  }

  // 공간사용예약(SCR-303)도 달력으로. 회원 전용이라 사용자 RLS 컨텍스트로 읽는다.
  if (board.board_type === "reservation") {
    if (!canReadBoard(board.read_roles, profile?.role ?? null)) {
      return (
        <main className="max-w-4xl mx-auto px-4">
          <AccessNotice boardName={board.name} readRoles={board.read_roles ?? []} loggedIn={!!profile} returnTo={`/boards/${slug}`} />
        </main>
      );
    }
    type RsvRow = {
      id: string; title: string; event_start: string | Date; event_end: string | Date | null;
      space_id: string | null; space_name: string | null; space_color: string | null; nickname: string | null;
    };
    const [rows, spaces] = await withUser(profile?.id ?? null, (c) =>
      Promise.all([
        many<RsvRow>(
          c,
          `select p.id, p.title, p.event_start, p.event_end, p.space_id,
                  s.name as space_name, s.color as space_color, a.nickname
             from posts p
             join boards b on b.id = p.board_id
             left join spaces s on s.id = p.space_id
             left join profiles a on a.id = p.author_id
            where b.slug = $1 and p.deleted_at is null and p.event_start is not null
            order by p.event_start asc`,
          [slug],
        ),
        many<{ id: string; name: string; color: string }>(
          c,
          "select id, name, color from spaces where is_active order by sort_order",
        ),
      ]),
    );
    const reservations = rows.map((r) => ({
      id: r.id,
      title: r.title,
      start: new Date(r.event_start).toISOString(),
      end: r.event_end ? new Date(r.event_end).toISOString() : null,
      spaceId: r.space_id,
      spaceName: r.space_name,
      spaceColor: r.space_color,
      nickname: r.nickname,
    }));
    return (
      <main className="max-w-4xl mx-auto px-4 pb-24">
        <div className="mt-6 mb-4">
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <ReservationCalendar reservations={reservations} spaces={spaces} slug={slug} canWrite={canWrite} />
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      {/* 셸 */}
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
          <WriteButton slug={slug} canWrite={canWrite} variant="header" />
        </div>
      </div>

      {/* 동적 목록 — Suspense 스트리밍 (정밀 스켈레톤 fallback) */}
      <Suspense fallback={<BoardListSkeleton />}>
        <BoardList slug={slug} board={board} searchParams={searchParams} />
      </Suspense>

      <WriteButton slug={slug} canWrite={canWrite} variant="fab" />
    </main>
  );
}
