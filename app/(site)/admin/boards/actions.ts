"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

// 권한 강제는 boards_admin RLS(admin 전용)에 위임. 액션은 입력 검증·파싱만 담당.
type AppRole = Database["public"]["Enums"]["app_role"];
type BoardType = Database["public"]["Enums"]["board_type"];
const ROLE_OPTS: AppRole[] = ["member", "operator", "teacher", "student"];
const BOARD_TYPES: BoardType[] = ["list", "gallery", "calendar", "reservation"];

function parseBoard(formData: FormData) {
  const publicRead = formData.get("public_read") === "on";
  const read_roles = publicRead ? null : ROLE_OPTS.filter((r) => formData.get(`read_${r}`) === "on");
  let write_roles = ROLE_OPTS.filter((r) => formData.get(`write_${r}`) === "on");
  if (write_roles.length === 0) write_roles = ["member", "operator", "teacher"]; // 빈 쓰기 권한 방지
  const bt = String(formData.get("board_type") ?? "list");
  return {
    slug: String(formData.get("slug") ?? "")
      .trim()
      .toLowerCase(),
    name: String(formData.get("name") ?? "").trim(),
    menu_group: String(formData.get("menu_group") ?? "").trim(),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    board_type: (BOARD_TYPES.includes(bt as BoardType) ? bt : "list") as BoardType,
    read_roles,
    write_roles,
    is_active: formData.get("is_active") === "on",
  };
}

function fail(msg: string): never {
  redirect(`/admin/boards?error=${encodeURIComponent(msg)}`);
}

function done() {
  revalidateTag("menu", "max"); // 헤더 메뉴·공개 slug 목록·게시판 메타 캐시 무효화
  revalidatePath("/admin/boards");
  redirect("/admin/boards");
}

export async function createBoard(formData: FormData) {
  const b = parseBoard(formData);
  if (!b.slug || !b.name || !b.menu_group) fail("슬러그·이름·메뉴그룹은 필수입니다");
  if (!/^[a-z0-9-]+$/.test(b.slug)) fail("슬러그는 영문 소문자·숫자·하이픈만 가능합니다");

  const supabase = await createClient();
  const { error } = await supabase.from("boards").insert(b);
  if (error) fail(error.code === "23505" ? "이미 사용 중인 슬러그입니다" : "생성에 실패했습니다(권한 확인)");
  done();
}

export async function updateBoard(id: string, formData: FormData) {
  const b = parseBoard(formData);
  if (!b.name || !b.menu_group) fail("이름·메뉴그룹은 필수입니다");

  // slug는 기존 글 URL(/boards/{slug}/...)·북마크가 걸려 있어 수정에서 제외(생성 시에만 지정).
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("boards")
    .update({
      name: b.name,
      menu_group: b.menu_group,
      sort_order: b.sort_order,
      board_type: b.board_type,
      read_roles: b.read_roles,
      write_roles: b.write_roles,
      is_active: b.is_active,
    })
    .eq("id", id)
    .select("id");
  if (error || !data?.length) fail("수정에 실패했습니다(권한 확인)");
  done();
}
