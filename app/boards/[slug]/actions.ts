"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath(`/boards/${slug}`);
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
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(`/boards/${slug}/${postId}/edit`)}`);

  const { data: board } = await supabase
    .from("boards")
    .select("id, board_type")
    .eq("slug", slug)
    .single();
  if (!board) redirect("/");

  // 권한은 RLS(posts_update)가 강제 — 본인/admin이 아니면 0행 갱신.
  // event_date는 createPost와 동일하게 달력형에서만 반영.
  const update: { title: string; content: string; event_date?: string | null } = {
    title,
    content,
  };
  if (board.board_type === "calendar") update.event_date = eventDate;

  const { data: updated, error } = await supabase
    .from("posts")
    .update(update)
    .eq("id", postId)
    .select("id");

  if (error || !updated || updated.length === 0) {
    redirect(
      `/boards/${slug}/${postId}/edit?error=${encodeURIComponent("수정에 실패했습니다. 권한을 확인해 주세요")}`,
    );
  }
  revalidatePath(`/boards/${slug}`);
  revalidatePath(`/boards/${slug}/${postId}`);
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
}

export async function deletePost(slug: string, postId: string) {
  const supabase = await createClient();
  // soft delete — RLS가 본인/admin만 허용
  await supabase
    .from("posts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", postId);
  revalidatePath(`/boards/${slug}`);
  redirect(`/boards/${slug}`);
}

export async function deleteComment(slug: string, postId: string, commentId: string) {
  const supabase = await createClient();
  await supabase
    .from("comments")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", commentId);
  revalidatePath(`/boards/${slug}/${postId}`);
}
