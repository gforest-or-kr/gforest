import { unstable_cache } from "next/cache";
import { publicClient } from "./supabase/public";

// 공개 게시판 데이터 페처 — 쿠키/세션을 읽지 않으므로 unstable_cache 안에서 안전하다.
// 공개 게시판(read_roles is null)은 모든 사용자에게 데이터가 동일하고 anon RLS가 전체를
// 정확히 반환한다(lib/menu-data.ts의 getMenuData와 같은 패턴). 글 작성/수정/삭제 시
// revalidateTag(`board:${slug}`)로 즉시 무효화한다.

// 게시판 메타 — 구성 변경은 드묾(10분 캐시). menu 태그로 admin 게시판 편집과도 연동.
export function getBoardMeta(slug: string) {
  return unstable_cache(
    async () => {
      const supabase = publicClient();
      // boards_select가 using(true)라 anon이 모든 board 행을 읽음 — 게시판 메타는 공개 메뉴용.
      const { data } = await supabase
        .from("boards")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    ["board-meta", slug],
    { revalidate: 600, tags: ["menu", `board:${slug}`] },
  )();
}

// 공개 게시판(read_roles is null) slug 목록 — generateStaticParams용. 공개 게시판만
// 빌드 시 정적 프리렌더해 prefetch가 작동하게 한다. 권한 게시판은 dynamicParams로 동적.
export function getPublicBoardSlugs() {
  return unstable_cache(
    async (): Promise<string[]> => {
      const supabase = publicClient();
      const { data } = await supabase
        .from("boards")
        .select("slug")
        .is("read_roles", null)
        .eq("is_active", true);
      return (data ?? []).map((b) => b.slug);
    },
    ["public-board-slugs"],
    { revalidate: 600, tags: ["menu"] },
  )();
}

// 공개 게시판 목록 + 고정 공지 — 글 작성/수정/삭제 시 태그 무효화하므로 revalidate는 백업 TTL.
export function getPublicBoardList(slug: string, page: number, pageSize: number) {
  return unstable_cache(
    async () => {
      const supabase = publicClient();
      const [{ data: notices }, { data: posts, count }] = await Promise.all([
        supabase
          .from("posts")
          .select("id, title, created_at, boards!inner(slug)")
          .eq("boards.slug", slug)
          .is("deleted_at", null)
          .eq("is_notice", true)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase
          .from("posts")
          .select(
            "id, title, created_at, view_count, is_notice, author:profiles(nickname), comments(count), attachments(count), boards!inner(slug)",
            { count: "exact" },
          )
          .eq("boards.slug", slug)
          .is("deleted_at", null)
          .eq("is_notice", false)
          .order("created_at", { ascending: false })
          .range((page - 1) * pageSize, page * pageSize - 1),
      ]);
      return { notices: notices ?? [], posts: posts ?? [], count: count ?? 0 };
    },
    ["board-list", slug, String(page)],
    { revalidate: 60, tags: [`board:${slug}`] },
  )();
}
