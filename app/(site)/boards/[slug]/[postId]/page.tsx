import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoardMeta, getPostDetail } from "@/lib/boards";
import PostView, { type PostViewData } from "@/components/post-view";
import MemberPostLoader from "@/components/member-post-loader";

// SEO/누설 방지(GFM-58): 공개글은 제목·요약을 메타로, 회원 게시판 글은 내용 누설 없이 noindex.
// getBoardMeta/getPostDetail은 쿠키를 안 읽어(캐시) ● 정적 생성이 유지된다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}): Promise<Metadata> {
  const { slug, postId } = await params;
  const board = await getBoardMeta(slug);
  if (!board) return {};
  if (board.read_roles !== null) {
    return { title: board.name, robots: { index: false, follow: false } };
  }
  const detail = await getPostDetail(slug, postId);
  if (!detail?.post) return { title: board.name };
  const desc =
    (detail.post.content || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 120) || undefined;
  return {
    title: detail.post.title,
    description: desc,
    openGraph: { title: detail.post.title, description: desc, type: "article" },
  };
}

// 정적 셸 + 클라 개인화 — 페이지는 쿠키를 안 읽어 정적(●)으로 유지된다(공개·회원 둘 다 빠름).
//  - 공개 게시판 글: 서버 anon(getPostDetail, 데이터 캐시)로 "풀 렌더" → 엣지 캐시·전체 prefetch
//    → 목록↔글 soft-nav 즉시 전환(중앙값 ~110ms).
//  - 권한(회원) 게시판 글: 서버가 쿠키를 읽으면 ● 라우트가 프로덕션 500(docs/design/rendering.md 9).
//    그래서 본문만 MemberPostLoader(클라)가 브라우저 세션(RLS)으로 "단일 왕복"에 가져온다(XE급).
// 분기는 board.read_roles(공개 메타, 쿠키 아님)로만 하므로 페이지는 모든 사용자에게 동일=정적.
// 첨부는 /dl/{id} 프록시 링크만 본문에 둔다(만료되는 서명 URL을 정적 HTML에 동결하지 않음).
export async function generateStaticParams() {
  return []; // 온디맨드 — 공개글은 첫 방문 시 생성·캐시, 회원글 셸도 정적
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

  // 권한 게시판: 페이지는 쿠키를 안 읽고 본문만 클라 세션으로 로드 (● 유지)
  if (board.read_roles !== null) {
    return (
      <MemberPostLoader
        slug={slug}
        postId={postId}
        boardId={board.id}
        boardName={board.name}
        readRoles={board.read_roles}
        writeRoles={board.write_roles}
      />
    );
  }

  // 공개 게시판: 서버 anon 렌더 (정적 엣지 캐시)
  const detail = await getPostDetail(slug, postId);
  if (!detail || !detail.post) notFound();
  return (
    <PostView
      slug={slug}
      boardName={board.name}
      writeRoles={board.write_roles}
      post={pick(detail.post)}
      author={detail.post.author as PostViewData["author"]}
      attachments={(detail.attachments as Att[]) ?? []}
      comments={detail.comments as PostViewData["comments"]}
      prevPost={detail.prevPost ?? null}
      nextPost={detail.nextPost ?? null}
    />
  );
}

function pick(post: {
  id: string; title: string; content: string; view_count: number;
  created_at: string; event_date: string | null; legacy_document_srl: number | null;
  content_html: boolean;
}): PostViewData["post"] {
  return {
    id: post.id, title: post.title, content: post.content, view_count: post.view_count,
    created_at: post.created_at, event_date: post.event_date, legacy_document_srl: post.legacy_document_srl,
    content_html: post.content_html,
  };
}
