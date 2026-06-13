"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  MAX_FILE_COUNT,
  MAX_FILE_SIZE,
  validateFile,
  type AttachmentMeta,
} from "@/lib/attachments";

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

// 권한 검사는 RLS가 강제한다 — 여기서는 insert/update 결과만 처리 (CLAUDE.md 원칙 3)

export async function createPost(slug: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  if (!title || !content) {
    redirect(`/boards/${slug}/write?error=${encodeURIComponent("제목과 내용을 입력해 주세요")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/write`)}`);

  const { data: board } = await supabase
    .from("boards")
    .select("id, board_type")
    .eq("slug", slug)
    .single();
  if (!board) redirect("/");

  const { data: post, error } = await supabase
    .from("posts")
    .insert({
      board_id: board.id,
      author_id: user.id,
      title,
      content,
      event_date: board.board_type === "calendar" ? eventDate : null,
    })
    .select("id")
    .single();

  if (error || !post) {
    redirect(
      `/boards/${slug}/write?error=${encodeURIComponent("등록에 실패했습니다. 쓰기 권한을 확인해 주세요")}`,
    );
  }

  // 첨부 메타 행 일괄 insert — 실패해도 글은 이미 생성됐으므로 롤백/중단하지 않는다
  const files = parseAttachments(formData.get("attachments"), user.id);
  if (files.length > 0) {
    await supabase.from("attachments").insert(
      files.map((f) => ({
        post_id: post.id,
        uploader_id: user.id,
        storage_path: f.storage_path,
        file_name: f.file_name,
        byte_size: f.byte_size,
        mime_type: f.mime_type,
      })),
    );
  }

  revalidatePath(`/boards/${slug}`);
  revalidateTag(`board:${slug}`, "max"); // 공개 게시판 목록 캐시 무효화 (lib/boards.ts)
  redirect(`/boards/${slug}/${post.id}`);
}

export async function updatePost(slug: string, postId: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  const eventDate = String(formData.get("event_date") ?? "") || null;
  if (!title || !content) {
    redirect(
      `/boards/${slug}/${postId}/edit?error=${encodeURIComponent("제목과 내용을 입력해 주세요")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  // board_type 확인 — calendar 게시판만 event_date 반영 (createPost와 동일 규칙)
  const { data: board } = await supabase
    .from("boards")
    .select("id, board_type")
    .eq("slug", slug)
    .single();
  if (!board) redirect("/");

  const { data: updated, error } = await supabase
    .from("posts")
    .update({
      title,
      content,
      event_date: board.board_type === "calendar" ? eventDate : null,
    })
    .eq("id", postId)
    .is("deleted_at", null)
    .select("id"); // 활성 글은 posts_select에 남으므로 성공 시 행 반환(createPost 패턴)

  // RLS가 0행을 걸러도 .update()는 에러를 주지 않으므로 반환 행 수를 직접 검증한다.
  if (error || !updated || updated.length === 0) {
    redirect(
      `/boards/${slug}/${postId}/edit?error=${encodeURIComponent("수정에 실패했습니다. 권한을 확인해 주세요")}`,
    );
  }

  revalidatePath(`/boards/${slug}`);
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`board:${slug}`, "max"); // 공개 게시판 목록 캐시 무효화 (제목 변경 즉시 반영)
  revalidateTag(`post:${postId}`, "max"); // 글 상세 ISR 캐시 무효화 (본문/제목 변경 즉시 반영)
  redirect(`/boards/${slug}/${postId}`);
}

export async function createComment(slug: string, postId: string, formData: FormData) {
  const content = String(formData.get("content") ?? "").trim();
  const parentId = String(formData.get("parent_id") ?? "") || null;
  if (!content) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}`)}`);

  await supabase.from("comments").insert({
    post_id: postId,
    author_id: user.id,
    content,
    parent_id: parentId,
  });
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`post:${postId}`, "max"); // 글 상세 ISR 캐시 무효화 (댓글 즉시 반영)
}

export async function deletePost(slug: string, postId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}`)}`);

  // soft delete — RLS(posts_update)가 본인/admin만 허용한다.
  const { error } = await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId)
    .is("deleted_at", null);

  // .update()는 RLS가 0행을 걸러도 에러를 주지 않으므로 결과를 직접 검증한다.
  // soft-delete된 행은 posts_select(deleted_at is null)에서 사라지므로 update의
  // RETURNING/.select()로는 성공 행을 되돌려 받을 수 없다(= createPost의 insert+select가
  // 동작하는 이유의 반대). 따라서 "여전히 보이는 글이 남아 있는가"를 재조회로 확인한다.
  const { data: stillVisible } = await supabase
    .from("posts")
    .select("id")
    .eq("id", postId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || stillVisible) {
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
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  revalidatePath(`/boards/${slug}/${postId}`);
  revalidateTag(`post:${postId}`, "max"); // 글 상세 ISR 캐시 무효화 (댓글 삭제 즉시 반영)
}
