import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoardMeta, getPostDetail, getMemberPostDetail } from "@/lib/boards";
import { getSessionProfile } from "@/lib/auth";
import { presignGetMany } from "@/lib/storage";
import { canReadBoard } from "@/lib/menu";
import AccessNotice from "@/components/access-notice";
import PostView, { type PostViewData } from "@/components/post-view";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SEO/누설 방지(GFM-58): 공개글은 제목·요약을 메타로, 회원 게시판 글은 내용 누설 없이 noindex.
// getBoardMeta/getPostDetail은 세션을 읽지 않는 캐시 페처(anon RLS)다.
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
  if (!UUID_RE.test(postId)) return { title: board.name };
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

// 글 상세 — 상시 구동 서버(ECS)라 페이지가 세션을 읽어도 되므로 서버에서 전부 렌더한다
// (docs/design/rendering.md 12). 개인화(수정/삭제·댓글 폼)는 profile을 props로 내려 결정한다.
//  - 공개 게시판 글: anon 캐시 페처(getPostDetail, 태그 무효화)로 데이터만 캐시.
//  - 권한(회원) 게시판 글: 사용자 RLS 컨텍스트(getMemberPostDetail, 비캐시)로 서버 렌더 — 예전
//    MemberPostLoader(클라 세션 fetch)를 대체. 비로그인·권한 없음은 AccessNotice.
// 인라인 이미지는 서버에서 배치 서명(presignGetMany, 로컬 연산)한 직링크로 렌더하고,
// 다운로드 <a>는 원본 파일명 disposition·영구 링크가 필요해 /dl/{id} 프록시를 유지한다.

type Att = PostViewData["attachments"][number] & { storage_path: string };

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const board = await getBoardMeta(slug);
  if (!board) notFound();
  if (!UUID_RE.test(postId)) notFound();

  const profile = await getSessionProfile();
  const viewer: PostViewData["profile"] = profile
    ? { id: profile.id, role: profile.role, nickname: profile.nickname }
    : null;

  let detail: Awaited<ReturnType<typeof getPostDetail>>;
  if (board.read_roles !== null) {
    // 권한 게시판: UI 차단은 여기서, 실제 차단은 RLS(getMemberPostDetail이 0행)
    if (!profile || !canReadBoard(board.read_roles, profile.role)) {
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
    detail = await getMemberPostDetail(profile.id, slug, postId);
  } else {
    detail = await getPostDetail(slug, postId);
  }
  if (!detail || !detail.post) notFound();

  const attachments = (detail.attachments as Att[]) ?? [];
  const imageUrls = await signInlineImages(attachments);

  return (
    <PostView
      slug={slug}
      boardName={board.name}
      writeRoles={board.write_roles}
      profile={viewer}
      post={pick(detail.post)}
      author={detail.post.author as PostViewData["author"]}
      attachments={attachments}
      imageUrls={imageUrls}
      comments={detail.comments as PostViewData["comments"]}
      prevPost={detail.prevPost ?? null}
      nextPost={detail.nextPost ?? null}
    />
  );
}

// 이미지 첨부의 서명 URL(1h) 배치 — id → URL. 서명 실패 시 undefined → PostView가 /dl로 폴백.
async function signInlineImages(attachments: Att[]): Promise<Record<string, string> | undefined> {
  const images = attachments.filter((a) => a.mime_type?.startsWith("image/") && a.storage_path);
  if (images.length === 0) return undefined;
  try {
    const byPath = await presignGetMany("attachments", images.map((a) => a.storage_path));
    const map: Record<string, string> = {};
    for (const a of images) {
      const url = byPath.get(a.storage_path);
      if (url) map[a.id] = url;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  } catch {
    return undefined;
  }
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
