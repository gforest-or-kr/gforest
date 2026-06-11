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
