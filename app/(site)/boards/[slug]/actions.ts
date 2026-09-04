"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { withUser, one, many, pgCode } from "@/lib/db";
import { getSessionUserId } from "@/lib/auth";
import { deleteMedia } from "@/lib/storage";
import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
  validateFile,
  type AttachmentMeta,
} from "@/lib/attachments";
import { sanitizeRichHtml, htmlIsEmpty } from "@/lib/sanitize";

// 폼 본문 파싱 — WYSIWYG(is_html=1)는 서버에서 정화한 HTML로, 아니면 plain text(레거시 수정)로.
function parseContent(formData: FormData): { content: string; isHtml: boolean; empty: boolean } {
  const isHtml = formData.get("is_html") === "1";
  const raw = String(formData.get("content") ?? "");
  const content = isHtml ? sanitizeRichHtml(raw) : raw.trim();
  return { content, isHtml, empty: isHtml ? htmlIsEmpty(content) : content.length === 0 };
}

// 폼 hidden input(JSON)의 첨부 메타를 파싱·재검증한다. 권한은 attachments_insert RLS가 최종 강제.
function parseAttachments(raw: unknown, userId: string): AttachmentMeta[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  return parsed
    .filter((it): it is AttachmentMeta => {
      if (!it || typeof it !== "object") return false;
      const m = it as Record<string, unknown>;
      return (
        typeof m.storage_path === "string" &&
        typeof m.file_name === "string" &&
        typeof m.byte_size === "number" &&
        typeof m.mime_type === "string" &&
        m.storage_path.startsWith(`${userId}/`) && // 본인 uid 프리픽스
        m.byte_size > 0 &&
        m.byte_size <= MAX_FILE_SIZE &&
        validateFile(m.file_name, m.byte_size) === null
      );
    })
    .slice(0, MAX_FILE_COUNT);
}

// 수정 시 제거할 기존 첨부 id 목록(JSON). 형식만 검증, 권한은 attachments_delete RLS가 강제.
function parseRemovedIds(raw: unknown): string[] {
  if (typeof raw !== "string" || raw.trim() === "") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === "string").slice(0, MAX_FILE_COUNT);
  } catch {
    return [];
  }
}

// 첨부 메타 행 일괄 insert — 글과 별도 트랜잭션. 실패해도 글은 이미 저장됐으므로 중단하지 않는다.
// (RLS attachments_insert: 업로더 본인 + 글 작성자 본인)
async function insertAttachments(userId: string, postId: string, files: AttachmentMeta[]) {
  if (files.length === 0) return;
  try {
    await withUser(userId, async (c) => {
      for (const f of files) {
        await c.query(
          `insert into attachments (post_id, uploader_id, storage_path, file_name, byte_size, mime_type)
           values ($1, $2, $3, $4, $5, $6)`,
          [postId, userId, f.storage_path, f.file_name, f.byte_size, f.mime_type],
        );
      }
    });
  } catch {
    // 첨부 실패는 글 저장을 되돌리지 않는다 (기존 동작 유지)
  }
}

// 권한 검사는 RLS가 강제한다 — 여기서는 insert/update 결과(영향 행 수·42501)만 처리 (CLAUDE.md 원칙 3)
// redirect()는 throw로 동작하므로 withUser 안에서 부르지 않는다(성공한 쓰기가 롤백됨).

export async function createPost(slug: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const { content, isHtml, empty } = parseContent(formData);
  const eventDate = String(formData.get("event_date") ?? "") || null;
  if (!title || empty) {
    redirect(`/boards/${slug}/write?error=${encodeURIComponent("제목과 내용을 입력해 주세요")}`);
  }

  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/write`)}`);

  const result = await withUser(userId, async (c) => {
    const board = await one<{ id: string; board_type: string }>(
      c,
      "select id, board_type from boards where slug = $1 and is_active",
      [slug],
    );
    if (!board) return { kind: "noboard" as const };
    try {
      const post = await one<{ id: string }>(
        c,
        `insert into posts (board_id, author_id, title, content, content_html, event_date, is_notice)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [
          board.id,
          userId,
          title,
          content,
          isHtml,
          board.board_type === "calendar" ? eventDate : null,
          formData.get("is_notice") === "on", // 권한은 guard_is_notice 트리거가 강제
        ],
      );
      return post ? { kind: "ok" as const, postId: post.id } : { kind: "fail" as const };
    } catch (e) {
      if (pgCode(e) === "42501") return { kind: "fail" as const }; // RLS(posts_insert) 거부
      throw e;
    }
  });

  if (result.kind === "noboard") redirect("/");
  if (result.kind === "fail") {
    redirect(
      `/boards/${slug}/write?error=${encodeURIComponent("등록에 실패했습니다. 쓰기 권한을 확인해 주세요")}`,
    );
  }

  await insertAttachments(userId, result.postId, parseAttachments(formData.get("attachments"), userId));

  revalidatePath(`/boards/${slug}`);
  revalidateTag(`board:${slug}`, "max"); // 공개 게시판 목록 캐시 무효화 (lib/boards.ts)
  redirect(`/boards/${slug}/${result.postId}`);
}

export async function updatePost(slug: string, postId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const { content, isHtml, empty } = parseContent(formData);
  const eventDate = String(formData.get("event_date") ?? "") || null;
  if (!title || empty) {
    redirect(
      `/boards/${slug}/${postId}/edit?error=${encodeURIComponent("제목과 내용을 입력해 주세요")}`,
    );
  }

  const userId = await getSessionUserId();
  if (!userId)
    redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  const result = await withUser(userId, async (c) => {
    // board_type 확인 — calendar 게시판만 event_date 반영 (createPost와 동일 규칙)
    const board = await one<{ id: string; board_type: string }>(
      c,
      "select id, board_type from boards where slug = $1 and is_active",
      [slug],
    );
    if (!board) return { kind: "noboard" as const };
    try {
      // RLS(posts_update)가 0행을 걸러도 에러가 아니므로 영향 행 수(rowCount)를 직접 검증한다.
      const r = await c.query(
        `update posts set title = $1, content = $2, content_html = $3, event_date = $4, is_notice = $5
         where id = $6 and deleted_at is null`,
        [
          title,
          content,
          isHtml,
          board.board_type === "calendar" ? eventDate : null,
          formData.get("is_notice") === "on", // 권한은 guard_is_notice 트리거가 강제
          postId,
        ],
      );
      return r.rowCount ? { kind: "ok" as const } : { kind: "fail" as const };
    } catch (e) {
      if (pgCode(e) === "42501" || pgCode(e) === "22P02") return { kind: "fail" as const };
      throw e;
    }
  });

  if (result.kind === "noboard") redirect("/");
  if (result.kind === "fail") {
    redirect(
      `/boards/${slug}/${postId}/edit?error=${encodeURIComponent("수정에 실패했습니다. 권한을 확인해 주세요")}`,
    );
  }

  // 첨부 편집: 제거된 기존 첨부는 행 삭제(RLS attachments_delete가 강제) 후 S3 객체 삭제,
  // 새 첨부는 행 추가. RETURNING이 RLS를 통과해 실제로 지워진 행의 경로만 돌려준다.
  const removedIds = parseRemovedIds(formData.get("removed_attachment_ids"));
  if (removedIds.length > 0) {
    let paths: string[] = [];
    try {
      paths = await withUser(userId, async (c) => {
        const rows = await many<{ storage_path: string }>(
          c,
          "delete from attachments where post_id = $1 and id = any($2::uuid[]) returning storage_path",
          [postId, removedIds],
        );
        return rows.map((a) => a.storage_path).filter(Boolean);
      });
    } catch {
      // 첨부 삭제 실패는 글 저장을 되돌리지 않는다
    }
    if (paths.length > 0) await deleteMedia("attachments", paths);
  }
  await insertAttachments(userId, postId, parseAttachments(formData.get("attachments"), userId));

  revalidatePath(`/boards/${slug}`);
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`board:${slug}`, "max"); // 공개 게시판 목록 캐시 무효화 (제목 변경 즉시 반영)
  revalidateTag(`post:${postId}`, "max"); // 공개 글 상세 캐시 무효화 (본문/제목 변경 즉시 반영)
  redirect(`/boards/${slug}/${postId}`);
}

export async function createComment(slug: string, postId: string, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "") || null;
  if (!content) return;

  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}`)}`);

  try {
    await withUser(userId, (c) =>
      c.query(
        "insert into comments (post_id, author_id, content, parent_id) values ($1, $2, $3, $4)",
        [postId, userId, content, parentId],
      ),
    );
  } catch {
    return { error: "댓글 등록에 실패했습니다. 권한을 확인해 주세요." }; // RLS(comments_insert) 거부 등
  }
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`post:${postId}`, "max"); // 공개 글 상세 캐시 무효화 (댓글 즉시 반영)
}

export async function updateComment(
  slug: string,
  postId: string,
  commentId: string,
  formData: FormData,
) {
  const content = String(formData.get("content") ?? "").trim();
  if (!content) return;

  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}`)}`);

  // 본문 수정 — RLS(comments_update)가 본인/admin만 허용. edited_at으로 '수정됨' 표시(소프트삭제와 구분)
  // RLS가 0행을 거르면 rowCount=0이므로 영향 행 수를 직접 확인한다.
  let updated = 0;
  try {
    updated = await withUser(userId, async (c) => {
      const r = await c.query(
        "update comments set content = $1, edited_at = now() where id = $2",
        [content, commentId],
      );
      return r.rowCount ?? 0;
    });
  } catch {
    updated = 0;
  }
  if (!updated) return { error: "댓글 수정에 실패했습니다. 권한을 확인해 주세요." };
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`post:${postId}`, "max");
}

export async function deletePost(slug: string, postId: string) {
  const userId = await getSessionUserId();
  if (!userId) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}`)}`);

  // soft delete — RLS(posts_update)가 본인/admin만 허용한다.
  // RLS가 0행을 걸러도 UPDATE는 에러가 아니므로 영향 행 수(rowCount)로 성공을 검증하고,
  // 같은 트랜잭션에서 "여전히 보이는 글이 남아 있는가"를 재조회로 한 번 더 확인한다.
  let ok = false;
  try {
    ok = await withUser(userId, async (c) => {
      const r = await c.query(
        "update posts set deleted_at = now() where id = $1 and deleted_at is null",
        [postId],
      );
      if (!r.rowCount) return false;
      const still = await one<{ id: string }>(
        c,
        "select id from posts where id = $1 and deleted_at is null",
        [postId],
      );
      return !still;
    });
  } catch {
    ok = false;
  }

  if (!ok) {
    redirect(
      `/boards/${slug}/${postId}?error=${encodeURIComponent("삭제에 실패했습니다. 권한을 확인해 주세요")}`,
    );
  }

  revalidatePath(`/boards/${slug}`);
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`board:${slug}`, "max"); // 공개 게시판 목록 캐시 무효화 (삭제 글 즉시 사라짐)
  redirect(`/boards/${slug}`);
}

export async function deleteComment(slug: string, postId: string, commentId: string) {
  const userId = await getSessionUserId();

  // soft delete — RLS(comments_update)가 본인/admin만 허용. deletePost와 같은 rowCount+재조회 검증.
  let ok = false;
  try {
    ok = await withUser(userId, async (c) => {
      const r = await c.query(
        "update comments set deleted_at = now() where id = $1 and deleted_at is null",
        [commentId],
      );
      if (!r.rowCount) return false;
      const still = await one<{ id: string }>(
        c,
        "select id from comments where id = $1 and deleted_at is null",
        [commentId],
      );
      return !still;
    });
  } catch {
    ok = false;
  }
  if (!ok) return { error: "댓글을 삭제할 수 없습니다. 권한을 확인해 주세요." };

  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`post:${postId}`, "max"); // 공개 글 상세 캐시 무효화 (댓글 삭제 즉시 반영)
}

// 조회수 증가 — ViewCounter(클라)가 마운트 시 호출. increment_view_count는 security definer라
// anon 컨텍스트로 실행한다. 정확성보다 가벼움이 우선이라 실패는 무시한다(기존 RPC와 동일).
export async function incrementViewCount(postId: string) {
  try {
    await withUser(null, (c) => c.query("select increment_view_count($1)", [postId]));
  } catch {
    // 미집계 허용
  }
}
