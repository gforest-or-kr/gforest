import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getBoardMeta, getPublicBoardSlugs, getCalendarEvents } from "@/lib/boards";
import WriteButton from "@/components/write-button";
import BoardList from "@/components/board-list";
import BoardListSkeleton from "@/components/board-list-skeleton";
import CalendarView from "@/components/calendar-view";

// 공개 게시판은 정적 프리렌더(prefetch 작동). 권한 게시판은 목록에서 쿠키를 읽어 동적 렌더된다.
export async function generateStaticParams() {
  const slugs = await getPublicBoardSlugs();
  return slugs.map((slug) => ({ slug }));
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
