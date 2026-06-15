import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getBoardMeta, getPostDetail } from "@/lib/boards";
import { getSessionProfile } from "@/lib/auth";
import { canReadBoard } from "@/lib/menu";
import AccessNotice from "@/components/access-notice";
import PostView, { type PostViewData } from "@/components/post-view";

// 공개글·회원글을 한 라우트에서 모두 "서버 렌더"한다. 핵심: 라우트에 revalidate를 두지 않는다.
//  - 공개 게시판 글: 쿠키를 안 읽어 정적 생성(●) → 엣지 캐시·prefetch (연속 전환 즉시).
//  - 권한(회원) 게시판 글: 쿠키(세션)를 읽어 동적 SSR → DB 한 번에 렌더(XE처럼 빠름, 클라 워터폴 없음).
//    같은 라우트지만 cookies 사용 여부로 Next가 요청별로 정적/동적을 자동 결정한다.
//    (revalidate를 두면 ISR로 강제돼 회원글의 쿠키 읽기가 프로덕션 500 — docs/design/rendering.md)
// 신선도: 글 편집·댓글 시 revalidateTag('post:id')가 공개 정적글을 무효화한다(시간 revalidate 불필요).
// 첨부 서명 URL은 본문에 박지 않고 /dl/{id} 프록시로 빼서, 정적 캐시가 만료 URL을 동결하지 않게 한다.
export async function generateStaticParams() {
  return []; // 온디맨드 — 첫 방문 시 공개글은 생성·캐시, 회원글은 동적 SSR
}

type Att = PostViewData["attachments"][number];

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const board = await getBoardMeta(slug);
  if (!board) notFound();

  let data: Omit<PostViewData, "slug" | "boardName" | "writeRoles">;

  if (board.read_roles === null) {
    // 공개글 — anon + 캐시(정적)
    const detail = await getPostDetail(slug, postId);
    if (!detail || !detail.post) notFound();
    data = {
      post: pick(detail.post),
      author: detail.post.author as PostViewData["author"],
      attachments: (detail.attachments as Att[]) ?? [],
      comments: detail.comments as PostViewData["comments"],
      prevPost: detail.prevPost ?? null,
      nextPost: detail.nextPost ?? null,
    };
  } else {
    // 회원글 — 세션(RLS)으로 동적 SSR
    const profile = await getSessionProfile();
    if (!canReadBoard(board.read_roles, profile?.role ?? null)) {
      return (
        <main className="max-w-3xl mx-auto px-4">
          <AccessNotice
            boardName={board.name}
            readRoles={board.read_roles}
            loggedIn={!!profile}
            returnTo={`/boards/${slug}/${postId}`}
          />
        </main>
      );
    }
    data = await fetchMemberPost(slug, postId);
  }

  return <PostView slug={slug} boardName={board.name} writeRoles={board.write_roles} {...data} />;
}

function pick(post: {
  id: string; title: string; content: string; view_count: number;
  created_at: string; event_date: string | null; legacy_document_srl: number | null;
}): PostViewData["post"] {
  return {
    id: post.id, title: post.title, content: post.content, view_count: post.view_count,
    created_at: post.created_at, event_date: post.event_date, legacy_document_srl: post.legacy_document_srl,
  };
}

async function fetchMemberPost(slug: string, postId: string) {
  const supabase = await createClient();
  const { data: post } = await supabase
    .from("posts")
    .select("*, author:profiles(id, nickname), boards!inner(slug)")
    .eq("id", postId)
    .eq("boards.slug", slug)
    .is("deleted_at", null)
    .single();
  if (!post) notFound();

  const [{ data: comments }, { data: attachments }, { data: prevPost }, { data: nextPost }] =
    await Promise.all([
      supabase
        .from("comments")
        .select("id, content, created_at, parent_id, author:profiles(id, nickname)")
        .eq("post_id", postId)
        .is("deleted_at", null)
        .order("created_at"),
      supabase
        .from("attachments")
        .select("id, file_name, byte_size, mime_type")
        .eq("post_id", postId)
        .order("created_at"),
      supabase.from("posts").select("id, title").eq("board_id", post.board_id).is("deleted_at", null)
        .lt("created_at", post.created_at).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("posts").select("id, title").eq("board_id", post.board_id).is("deleted_at", null)
        .gt("created_at", post.created_at).order("created_at").limit(1).maybeSingle(),
    ]);

  return {
    post: pick(post),
    author: post.author as PostViewData["author"],
    attachments: (attachments as Att[]) ?? [],
    comments: (comments ?? []) as PostViewData["comments"],
    prevPost: prevPost ?? null,
    nextPost: nextPost ?? null,
  };
}
