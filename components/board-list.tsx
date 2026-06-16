import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { publicClient } from "@/lib/supabase/public";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import { getBoardMeta, getPublicBoardList } from "@/lib/boards";
import { shortDate } from "@/lib/format";
import AccessNotice from "@/components/access-notice";

const PAGE_SIZE = 20;

type Board = NonNullable<Awaited<ReturnType<typeof getBoardMeta>>>;

// 게시판 목록 영역 — Suspense 안에서 스트리밍된다(동적). searchParams를 여기서 await하므로
// 이 컴포넌트만 동적이고, page 셸(헤더/제목/검색/글쓰기)은 정적으로 prerender된다.
// 권한 게시판은 여기서 서버 인증(getSessionProfile)을 하므로 dynamicParams 경로로 동작한다.
export default async function BoardList({
  slug,
  board,
  searchParams,
}: {
  slug: string;
  board: Board;
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const { page: pageParam, q } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  // 권한 게시판 — 읽기 권한 확인 (UI 차단; 실제 차단은 RLS)
  if (board.read_roles !== null) {
    const profile = await getSessionProfile();
    if (!canReadBoard(board.read_roles, profile?.role ?? null)) {
      return (
        <AccessNotice
          boardName={board.name}
          readRoles={board.read_roles ?? []}
          loggedIn={!!profile}
          returnTo={`/boards/${slug}`}
        />
      );
    }
  }

  type ListData = Awaited<ReturnType<typeof getPublicBoardList>>;
  let notices: ListData["notices"];
  let posts: ListData["posts"];
  let count: number;

  if (board.read_roles === null && !q) {
    // 공개 게시판 목록 — unstable_cache 경로
    const data = await getPublicBoardList(slug, page, PAGE_SIZE);
    notices = data.notices;
    posts = data.posts;
    count = data.count;
  } else {
    // 게이트 게시판 또는 검색(?q=) — RLS 동적 경로
    const supabase = await createClient();
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
    if (q) {
      // PostgREST .or() 필터에 검색어를 그대로 넣으면 쉼표·괄호가 구분자로 파싱돼 깨진다.
      // 패턴 값을 큰따옴표로 감싸 리터럴로 처리하고, 값 안의 "·\ 만 이스케이프한다.
      const safe = q.replace(/[\\"]/g, (m) => "\\" + m);
      listQuery = listQuery.or(`title.ilike."%${safe}%",content.ilike."%${safe}%"`);
    }

    const [{ data: noticeRows }, { data: postRows, count: postCount }] = await Promise.all([
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
    notices = noticeRows ?? [];
    posts = postRows ?? [];
    count = postCount ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const rows = posts.map((p) => ({
    ...p,
    nickname: (p.author as { nickname: string } | null)?.nickname ?? "알 수 없음",
    commentCount: (p.comments as unknown as { count: number }[])[0]?.count ?? 0,
    fileCount: (p.attachments as unknown as { count: number }[])[0]?.count ?? 0,
  }));

  // 갤러리 게시판: 글마다 첫 이미지 첨부를 썸네일로 보여준다. 목록 데이터 경로(공개=캐시/
  // 회원=RLS)와 별개로, 보이는 글들의 이미지 첨부 id만 한 번에 모아 /dl 프록시로 렌더한다.
  // (BoardList는 이미 Suspense 안에서 동적 스트리밍 — 셸 정적/prefetch는 그대로 유지된다.)
  const isGallery = board.board_type === "gallery";
  const thumb: Record<string, string> = {};
  if (isGallery && rows.length > 0) {
    const sb = board.read_roles === null ? publicClient() : await createClient();
    const { data: atts } = await sb
      .from("attachments")
      .select("id, post_id, mime_type, created_at")
      .in("post_id", rows.map((r) => r.id))
      .like("mime_type", "image/%")
      .order("created_at", { ascending: true });
    for (const a of (atts ?? []) as { id: string; post_id: string }[]) {
      if (!thumb[a.post_id]) thumb[a.post_id] = a.id; // 글당 첫 이미지
    }
  }

  const Pager = () => (
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
  );

  return (
    <>
      {q && (
        <p className="mb-3 text-sm text-slate-500">
          &lsquo;{q}&rsquo; 검색 결과 {count ?? 0}건{" "}
          <Link href={`/boards/${slug}`} className="text-forest-600 font-medium ml-1">
            전체 보기
          </Link>
        </p>
      )}

      {(notices ?? []).length > 0 && (
        <div className="rounded-2xl bg-forest-50/80 border border-forest-100 divide-y divide-forest-100/60 mb-3">
          {(notices ?? []).map((n) => (
            <Link
              key={n.id}
              href={`/boards/${slug}/${n.id}`}
              prefetch
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
        </div>
      ) : isGallery ? (
        <>
          {/* 갤러리: 썸네일 그리드 (모바일 2열 / 데스크탑 3~4열) */}
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {rows.map((p) => (
              <li key={p.id}>
                <Link href={`/boards/${slug}/${p.id}`} prefetch className="block group">
                  <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100">
                    {thumb[p.id] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/dl/${thumb[p.id]}?inline=1`}
                        alt={p.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-active:opacity-90"
                      />
                    ) : (
                      <div className="w-full h-full grid place-items-center text-slate-300 text-3xl">
                        🖼️
                      </div>
                    )}
                  </div>
                  <p className="mt-1.5 text-sm font-medium leading-snug line-clamp-2">{p.title}</p>
                  <p className="text-xs text-slate-400">
                    {p.nickname} · {shortDate(p.created_at)}
                    {p.commentCount > 0 && (
                      <span className="text-forest-600 font-semibold"> · 댓글 {p.commentCount}</span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {totalPages > 1 && <Pager />}
        </>
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
                    <Link href={`/boards/${slug}/${p.id}`} prefetch className="hover:text-forest-700">
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
                <Link href={`/boards/${slug}/${p.id}`} prefetch className="block py-3.5 active:bg-slate-50">
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

          {totalPages > 1 && <Pager />}
        </>
      )}
    </>
  );
}
