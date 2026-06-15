import { notFound } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { getBoardMeta, getPostDetail } from "@/lib/boards";
import PostView from "@/components/post-view";
import MemberPostLoader from "@/components/member-post-loader";

// 정적 셸 + 클라 개인화 패턴(docs/design/rendering.md, 모바일 속도 개선 기록):
// 페이지는 쿠키를 읽지 않아 ISR(●)로 유지 → router cache·prefetch가 살아 연속 전환이 즉시화된다.
//  - 공개 게시판 글: 서버에서 getPostDetail(anon)로 렌더 → 엣지 캐시.
//  - 권한(회원) 게시판 글: 쿠키를 서버에서 읽으면 ISR이 깨지므로(프로덕션 500), 본문은
//    MemberPostLoader(클라)가 브라우저 세션(RLS)으로 가져와 렌더한다.
export const revalidate = 300; // 첨부 서명 URL(1시간)보다 짧게
export async function generateStaticParams() {
  return []; // 온디맨드 ISR — 첫 방문 시 생성·캐시
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string; postId: string }>;
}) {
  const { slug, postId } = await params;
  const board = await getBoardMeta(slug);
  if (!board) notFound();

  // 권한 게시판: 페이지는 쿠키를 안 읽고, 본문만 클라에서 세션으로 로드 (ISR 유지)
  if (board.read_roles !== null) {
    return (
      <MemberPostLoader
        slug={slug}
        postId={postId}
        boardName={board.name}
        readRoles={board.read_roles}
        writeRoles={board.write_roles}
      />
    );
  }

  // 공개 게시판: 서버에서 anon으로 렌더 (ISR 엣지 캐시)
  const detail = await getPostDetail(slug, postId);
  if (!detail || !detail.post) notFound();
  const { post, comments, attachments, prevPost, nextPost } = detail;

  const signer = publicClient();
  const signed = await Promise.all(
    attachments.map(async (f) => {
      const { data } = await signer.storage.from("attachments").createSignedUrl(f.storage_path, 3600);
      return {
        id: f.id, file_name: f.file_name, byte_size: f.byte_size, mime_type: f.mime_type, url: data?.signedUrl ?? null,
      };
    }),
  );

  return (
    <PostView
      slug={slug}
      boardName={board.name}
      writeRoles={board.write_roles}
      post={{
        id: post.id, title: post.title, content: post.content, view_count: post.view_count,
        created_at: post.created_at, event_date: post.event_date, legacy_document_srl: post.legacy_document_srl,
      }}
      author={post.author as { id: string; nickname: string } | null}
      attachments={signed}
      comments={comments as Parameters<typeof PostView>[0]["comments"]}
      prevPost={prevPost ?? null}
      nextPost={nextPost ?? null}
    />
  );
}
