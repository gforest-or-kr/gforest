import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import { shortDate } from "@/lib/format";
import AccessNotice from "@/components/access-notice";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type Params = { slug: string };
type SearchParams = { page?: string; q?: string };

export default async function BoardPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const supabase = await createClient();

  // 모든 쿼리를 slug 조인으로 1회 왕복에 병렬 실행 (GFM-30 — 워터폴 제거)
  let listQuery = supabase
    .from("posts")
    .select(
      "id, title, created_at, view_count, is_notice, author:profiles(nickname), comments(count), attachments(count), boards!inner(slug)",
      { count: "exact" },
    )
    .eq("boards.slug", slug)
    .is("deleted_at", null)
    .eq("is_notice", false)
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (q) listQuery = listQuery.or(`title.ilike.%${q}%,content.ilike.%${q}%`);

  const [profile, { data: board }, { data: notices }, { data: posts, count }] =
    await Promise.all([
      getSessionProfile(),
      supabase.from("boards").select("*").eq("slug", slug).eq("is_active", true).single(),
      q
        ? Promise.resolve({ data: [] as never[] })
        : supabase
            .from("posts")
            .select("id, title, created_at, boards!inner(slug)")
            .eq("boards.slug", slug)
            .is("deleted_at", null)
            .eq("is_notice", true)
            .order("created_at", { ascending: false })
            .limit(5),
      listQuery,
    ]);
  if (!board) notFound();

  const role = profile?.role ?? null;

  // UI 노출 제어 — 실제 차단은 RLS (권한 없으면 위 posts 쿼리도 빈 결과)
  if (!canReadBoard(board.read_roles, role)) {
    return (
      <main className="max-w-6xl mx-auto px-4">
        <AccessNotice
          boardName={board.name}
          readRoles={board.read_roles ?? []}
          loggedIn={!!profile}
          returnTo={`/boards/${slug}`}
        />
      </main>
    );
  }

  const canWrite =
    !!role && (role === "admin" || board.write_roles.includes(role));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const rows = (posts ?? []).map((p) => ({
    ...p,
    nickname: (p.author as { nickname: string } | null)?.nickname ?? "알 수 없음",
    commentCount: (p.comments as unknown as { count: number }[])[0]?.count ?? 0,
    fileCount: (p.attachments as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  return (
    <main className="max-w-6xl mx-auto px-4 pb-24">
      {/* 게시판 헤더 */}
      <div className="mt-6 mb-4 flex flex-wrap items-center gap-3">
        <div>
          <p className="text-xs text-slate-400 mb-0.5">{board.menu_group}</p>
          <h1 className="text-2xl font-bold">{board.name}</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <form className="flex items-center gap-2" action={`/boards/${slug}`}>
            <input
              name="q"
              defaultValue={q ?? ""}
              className="border border-slate-200 rounded-xl text-sm px-3 py-2 w-36 sm:w-56"
              placeholder="제목+내용 검색"
            />
          </form>
          {canWrite && (
            <Link
              href={`/boards/${slug}/write`}
              className="hidden sm:block bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-4 py-2 rounded-xl"
            >
              글쓰기
            </Link>
          )}
        </div>
      </div>

      {q && (
        <p className="mb-3 text-sm text-slate-500">
          &lsquo;{q}&rsquo; 검색 결과 {count ?? 0}건{" "}
          <Link href={`/boards/${slug}`} className="text-forest-600 font-medium ml-1">
            전체 보기
          </Link>
        </p>
      )}

      {/* 고정 공지 */}
      {(notices ?? []).length > 0 && (
        <div className="rounded-2xl bg-forest-50/80 border border-forest-100 divide-y divide-forest-100/60 mb-3">
          {(notices ?? []).map((n) => (
            <Link
              key={n.id}
              href={`/boards/${slug}/${n.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm"
            >
              <span className="shrink-0 text-[11px] font-bold text-forest-700 bg-white border border-forest-200 rounded-full px-2 py-0.5">
                공지
              </span>
              <span className="font-medium truncate">{n.title}</span>
              <span className="ml-auto text-xs text-slate-400 shrink-0">
                {shortDate(n.created_at)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-20 text-center text-slate-400 text-sm">
          {q ? "검색 결과가 없습니다" : "아직 게시글이 없습니다"}
          {!q && canWrite && (
            <p className="mt-3">
              <Link href={`/boards/${slug}/write`} className="text-forest-600 font-medium">
                첫 글을 작성해 보세요 →
              </Link>
            </p>
          )}
        </div>
      ) : (
        <>
          {/* 데스크탑: 테이블 */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-400 border-b border-slate-100">
                <th className="text-left font-medium py-2.5 pl-2">제목</th>
                <th className="w-28 font-medium">작성자</th>
                <th className="w-20 font-medium">날짜</th>
                <th className="w-16 font-medium">조회</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60">
                  <td className="py-3 pl-2">
                    <Link href={`/boards/${slug}/${p.id}`} className="hover:text-forest-700">
                      {p.title}
                      {p.fileCount > 0 && <span className="text-slate-300 ml-1">📎</span>}
                      {p.commentCount > 0 && (
                        <b className="text-forest-600 font-semibold text-xs ml-1">
                          [{p.commentCount}]
                        </b>
                      )}
                    </Link>
                  </td>
                  <td className="text-center text-slate-500">{p.nickname}</td>
                  <td className="text-center text-slate-400 text-xs">{shortDate(p.created_at)}</td>
                  <td className="text-center text-slate-400 text-xs">{p.view_count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* 모바일: 카드 리스트 */}
          <ul className="sm:hidden divide-y divide-slate-50">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/boards/${slug}/${p.id}`} className="block py-3.5 active:bg-slate-50">
                  <p className="font-medium leading-snug line-clamp-2">
                    {p.title}
                    {p.fileCount > 0 && " 📎"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {p.nickname} · {shortDate(p.created_at)} · 조회 {p.view_count}
                    {p.commentCount > 0 && (
                      <span className="text-forest-600 font-semibold"> · 댓글 {p.commentCount}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* 페이징 */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-1 mt-6 text-sm">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((n) => Math.abs(n - page) <= 2 || n === 1 || n === totalPages)
                .map((n, i, arr) => (
                  <span key={n} className="flex items-center gap-1">
                    {i > 0 && arr[i - 1] !== n - 1 && <span className="px-1 text-slate-300">…</span>}
                    <Link
                      href={`/boards/${slug}?page=${n}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                      className={`px-3 py-1.5 rounded-lg ${
                        n === page ? "bg-forest-600 text-white font-medium" : "hover:bg-slate-50"
                      }`}
                    >
                      {n}
                    </Link>
                  </span>
                ))}
            </div>
          )}
        </>
      )}

      {/* 모바일 FAB */}
      {canWrite && (
        <Link
          href={`/boards/${slug}/write`}
          className="sm:hidden fixed bottom-6 right-5 z-40 w-14 h-14 rounded-full bg-forest-600 text-white shadow-lg shadow-forest-600/30 grid place-items-center"
          aria-label="글쓰기"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      )}
    </main>
  );
}
