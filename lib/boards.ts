import { unstable_cache } from "next/cache";
import { withUser, one, many, type DbClient } from "@/lib/db";
import type { Database } from "@/lib/db/types";

// 공개 게시판 데이터 페처 — 쿠키/세션을 읽지 않고 withUser(null)(anon RLS 컨텍스트)로 조회하므로
// unstable_cache 안에서 안전하다. 공개 게시판(read_roles is null)은 모든 사용자에게 데이터가
// 동일하고 anon RLS가 전체를 정확히 반환한다(lib/menu-data.ts의 getMenuData와 같은 패턴).
// 글 작성/수정/삭제 시 revalidateTag(`board:${slug}`)로 즉시 무효화한다.
//
// 회원 게시판용(getMemberPostDetail·getBoardListForUser)은 같은 SQL을 사용자 RLS 컨텍스트
// (withUser(userId))에서 캐시 없이 실행한다 — 권한 판정은 여전히 DB(RLS)가 한다.
//
// pg 드라이버 주의: bigint/count는 문자열, enum[]은 '{a,b}' 원문, timestamptz/date는 Date 객체로
// 오므로 SQL에서 ::int / ::text[] / ISO 문자열로 캐스팅해 lib/db/types.ts 의 Row 타입과 같은 JS 값을 만든다.

type Tables = Database["public"]["Tables"];
export type BoardRow = Tables["boards"]["Row"];
export type PostRow = Tables["posts"]["Row"];

// timestamptz → ISO 8601 문자열(to_json은 '2026-06-11T03:00:00.123+00:00' 형식)
const ts = (col: string) => `to_json(${col})#>>'{}'`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: string) => UUID_RE.test(v);

const BOARD_COLS = `id, slug, name, description, menu_group, sort_order, board_type,
  read_roles::text[] as read_roles, write_roles::text[] as write_roles, is_active, legacy_mid,
  ${ts("created_at")} as created_at`;

// 게시판 메타 — 구성 변경은 드묾(10분 캐시). menu 태그로 admin 게시판 편집과도 연동.
export function getBoardMeta(slug: string) {
  return unstable_cache(
    async () =>
      withUser(null, (c) =>
        // boards_select가 using(true)라 anon이 모든 board 행을 읽음 — 게시판 메타는 공개 메뉴용.
        one<BoardRow>(c, `select ${BOARD_COLS} from boards where slug = $1 and is_active = true`, [slug]),
      ),
    ["board-meta", slug],
    { revalidate: 600, tags: ["menu", `board:${slug}`] },
  )();
}

// 공개 게시판(read_roles is null) slug 목록 — generateStaticParams용. 공개 게시판만
// 빌드 시 정적 프리렌더해 prefetch가 작동하게 한다. 권한 게시판은 dynamicParams로 동적.
export function getPublicBoardSlugs() {
  return unstable_cache(
    async (): Promise<string[]> => {
      const rows = await withUser(null, (c) =>
        many<{ slug: string }>(c, "select slug from boards where read_roles is null and is_active = true"),
      );
      return rows.map((b) => b.slug);
    },
    ["public-board-slugs"],
    { revalidate: 600, tags: ["menu"] },
  )();
}

// ---- 목록 ---------------------------------------------------------------

export type ListNotice = { id: string; title: string; created_at: string; boards: { slug: string } };
export type ListPost = {
  id: string;
  title: string;
  created_at: string;
  view_count: number;
  is_notice: boolean;
  author: { nickname: string } | null;
  comments: { count: number }[];
  attachments: { count: number }[];
  boards: { slug: string };
};
export type BoardListData = { notices: ListNotice[]; posts: ListPost[]; count: number };

// ilike 패턴 메타문자(% _ \)를 이스케이프해 검색어를 리터럴로 취급한다.
const likeLiteral = (q: string) => `%${q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;

// 목록 + 고정 공지 + 총 건수. q(검색어)가 있으면 공지 영역은 비우고 제목+내용 ilike로 거른다.
async function fetchBoardList(
  c: DbClient,
  slug: string,
  page: number,
  pageSize: number,
  q?: string,
): Promise<BoardListData> {
  const notices = q
    ? []
    : await many<ListNotice>(
        c,
        `select p.id, p.title, ${ts("p.created_at")} as created_at, json_build_object('slug', b.slug) as boards
         from posts p join boards b on b.id = p.board_id
         where b.slug = $1 and p.deleted_at is null and p.is_notice = true
         order by p.created_at desc limit 5`,
        [slug],
      );

  const where = `b.slug = $1 and p.deleted_at is null and p.is_notice = false
    ${q ? "and (p.title ilike $2 or p.content ilike $2)" : ""}`;
  const params: unknown[] = q ? [slug, likeLiteral(q)] : [slug];

  type Raw = Omit<ListPost, "comments" | "attachments"> & { comment_count: number; file_count: number };
  const rows = await many<Raw>(
    c,
    `select p.id, p.title, ${ts("p.created_at")} as created_at, p.view_count, p.is_notice,
       (select json_build_object('nickname', pr.nickname) from profiles pr where pr.id = p.author_id) as author,
       (select count(*) from comments x where x.post_id = p.id and x.deleted_at is null)::int as comment_count,
       (select count(*) from attachments x where x.post_id = p.id)::int as file_count,
       json_build_object('slug', b.slug) as boards
     from posts p join boards b on b.id = p.board_id
     where ${where}
     order by p.created_at desc
     limit $${params.length + 1} offset $${params.length + 2}`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  const total = await one<{ count: number }>(
    c,
    `select count(*)::int as count from posts p join boards b on b.id = p.board_id where ${where}`,
    params,
  );

  return {
    notices,
    posts: rows.map(({ comment_count, file_count, ...p }) => ({
      ...p,
      comments: [{ count: comment_count }],
      attachments: [{ count: file_count }],
    })),
    count: total?.count ?? 0,
  };
}

// 공개 게시판 목록 + 고정 공지 — 글 작성/수정/삭제 시 태그 무효화하므로 revalidate는 백업 TTL.
export function getPublicBoardList(slug: string, page: number, pageSize: number) {
  return unstable_cache(
    async () => withUser(null, (c) => fetchBoardList(c, slug, page, pageSize)),
    ["board-list", slug, String(page)],
    { revalidate: 60, tags: [`board:${slug}`] },
  )();
}

// 회원(권한) 게시판 목록 또는 검색(?q=) — 사용자 RLS 컨텍스트, 캐시 없음. userId=null이면 anon.
export function getBoardListForUser(
  userId: string | null,
  slug: string,
  page: number,
  pageSize: number,
  q?: string,
) {
  return withUser(userId, (c) => fetchBoardList(c, slug, page, pageSize, q || undefined));
}

// ---- 캘린더 -------------------------------------------------------------

// 캘린더형 게시판(board_type=calendar)의 일정 — event_date 있는 글만. 학교 일정은 소수라
// 전체를 가져와 클라에서 월 이동을 즉시 처리한다. 글 작성/삭제 시 board:slug 태그로 무효화.
export function getCalendarEvents(slug: string) {
  return unstable_cache(
    async () => {
      const rows = await withUser(null, (c) =>
        many<{ id: string; title: string; event_date: string }>(
          c,
          `select p.id, p.title, p.event_date::text as event_date
           from posts p join boards b on b.id = p.board_id
           where b.slug = $1 and p.deleted_at is null and p.event_date is not null
           order by p.event_date asc`,
          [slug],
        ),
      );
      return rows.map((p) => ({
        id: p.id,
        title: p.title,
        date: p.event_date, // 'YYYY-MM-DD'
      }));
    },
    ["calendar-events", slug],
    { revalidate: 300, tags: [`board:${slug}`] },
  )();
}

// ---- 글 상세 ------------------------------------------------------------

export type PostDetailPost = PostRow & {
  author: { id: string; nickname: string } | null;
  boards: { slug: string };
};
export type PostDetailComment = {
  id: string;
  content: string;
  created_at: string;
  edited_at: string | null;
  parent_id: string | null;
  author: { id: string; nickname: string } | null;
};
export type PostDetailAttachment = {
  id: string;
  file_name: string;
  byte_size: number;
  storage_path: string;
  mime_type: string;
};
export type PostDetail = {
  post: PostDetailPost;
  comments: PostDetailComment[];
  attachments: PostDetailAttachment[];
  prevPost: { id: string; title: string } | null;
  nextPost: { id: string; title: string } | null;
};

const POST_COLS = `p.id, p.board_id, p.author_id, p.title, p.content, p.content_html, p.is_notice,
  p.event_date::text as event_date, ${ts("p.event_start")} as event_start, ${ts("p.event_end")} as event_end,
  p.space_id, p.view_count, p.legacy_document_srl::int as legacy_document_srl,
  ${ts("p.created_at")} as created_at, ${ts("p.updated_at")} as updated_at, ${ts("p.deleted_at")} as deleted_at`;

// 본문·댓글·첨부메타·이전/다음을 한 묶음으로. 호출자의 RLS 컨텍스트(anon/회원)를 그대로 따른다.
async function fetchPostDetail(c: DbClient, slug: string, postId: string): Promise<PostDetail | null> {
  if (!isUuid(postId)) return null; // uuid 캐스팅 오류(22P02) 대신 404 경로로
  const post = await one<PostDetailPost>(
    c,
    `select ${POST_COLS},
       (select json_build_object('id', pr.id, 'nickname', pr.nickname) from profiles pr where pr.id = p.author_id) as author,
       json_build_object('slug', b.slug) as boards
     from posts p join boards b on b.id = p.board_id
     where p.id = $1 and b.slug = $2 and p.deleted_at is null`,
    [postId, slug],
  );
  if (!post) return null;

  const comments = await many<PostDetailComment>(
    c,
    `select c.id, c.content, ${ts("c.created_at")} as created_at, ${ts("c.edited_at")} as edited_at, c.parent_id,
       (select json_build_object('id', pr.id, 'nickname', pr.nickname) from profiles pr where pr.id = c.author_id) as author
     from comments c where c.post_id = $1 and c.deleted_at is null order by c.created_at`,
    [postId],
  );
  const attachments = await many<PostDetailAttachment>(
    c,
    `select id, file_name, byte_size::int as byte_size, storage_path, mime_type
     from attachments where post_id = $1 order by created_at`,
    [postId],
  );
  const prevPost = await one<{ id: string; title: string }>(
    c,
    `select id, title from posts where board_id = $1 and deleted_at is null and created_at < $2
     order by created_at desc limit 1`,
    [post.board_id, post.created_at],
  );
  const nextPost = await one<{ id: string; title: string }>(
    c,
    `select id, title from posts where board_id = $1 and deleted_at is null and created_at > $2
     order by created_at asc limit 1`,
    [post.board_id, post.created_at],
  );
  return { post, comments, attachments, prevPost, nextPost };
}

// 공개 게시판 글 상세 — anon 컨텍스트로 조회해 데이터 캐시.
// 댓글 작성/삭제·글 수정 시 revalidateTag(`post:${postId}`)로 즉시 무효화한다.
// 첨부 "서명 URL"은 만료가 있어 여기 넣지 않고, page에서 메타로 그때 생성한다(캐시 주기 < 1시간).
export function getPostDetail(slug: string, postId: string) {
  return unstable_cache(
    async () => withUser(null, (c) => fetchPostDetail(c, slug, postId)),
    ["post-detail", slug, postId],
    { revalidate: 300, tags: [`post:${postId}`, `board:${slug}`] },
  )();
}

// 회원(권한) 게시판 글 상세 — 사용자 RLS 컨텍스트, 캐시 없음(사용자마다 가시성이 다르다).
// 권한 없는 글은 RLS가 0행을 돌려주므로 null → 호출자가 notFound/접근 안내 처리.
export function getMemberPostDetail(userId: string, slug: string, postId: string) {
  return withUser(userId, (c) => fetchPostDetail(c, slug, postId));
}
