"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 권한 강제는 slides_admin RLS + site_admin_* Storage 정책에 위임(CLAUDE.md #3).
// 액션은 입력 검증·스토리지 경로 관리만 담당한다.

const MAX_BYTES = 2 * 1024 * 1024; // 2MB — site 버킷 file_size_limit과 동일
const BUCKET = "site";

function revalidate() {
  revalidatePath("/admin/slides");
  revalidatePath("/");
}

function ext(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot > -1 ? file.name.slice(dot + 1).toLowerCase() : "img";
}

// 파일이 이미지이고 2MB 이하인지 검증. 통과 못 하면 메시지 반환.
function checkImage(file: File | null, label: string): string | null {
  if (!file || file.size === 0) return `${label} 이미지를 선택하세요`;
  if (!file.type.startsWith("image/")) return `${label} 이미지 형식이 아닙니다`;
  if (file.size > MAX_BYTES) return `${label} 이미지는 2MB 이하여야 합니다`;
  return null;
}

export async function createSlide(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const link_url = String(formData.get("link_url") ?? "").trim() || null;
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  const desktop = formData.get("image_desktop") as File | null;
  const mobile = formData.get("image_mobile") as File | null;

  if (!title) return;
  if (checkImage(desktop, "데스크탑")) return;
  if (checkImage(mobile, "모바일")) return;

  const supabase = await createClient();
  const id = crypto.randomUUID();
  const desktopPath = `slides/${id}-d.${ext(desktop!)}`;
  const mobilePath = `slides/${id}-m.${ext(mobile!)}`;

  const up1 = await supabase.storage
    .from(BUCKET)
    .upload(desktopPath, desktop!, { contentType: desktop!.type });
  if (up1.error) return;

  const up2 = await supabase.storage
    .from(BUCKET)
    .upload(mobilePath, mobile!, { contentType: mobile!.type });
  if (up2.error) {
    await supabase.storage.from(BUCKET).remove([desktopPath]);
    return;
  }

  const { error } = await supabase.from("slides").insert({
    id,
    title,
    subtitle,
    link_url,
    image_desktop_path: desktopPath,
    image_mobile_path: mobilePath,
    sort_order,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([desktopPath, mobilePath]);
    return;
  }

  revalidate();
}

// 메타데이터만 갱신(이미지 미변경 시 path 유지)
export async function updateSlide(id: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  await supabase
    .from("slides")
    .update({
      title,
      subtitle: String(formData.get("subtitle") ?? "").trim() || null,
      link_url: String(formData.get("link_url") ?? "").trim() || null,
      sort_order: Number(formData.get("sort_order") ?? 0) || 0,
      is_active: formData.get("is_active") === "on",
    })
    .eq("id", id);

  revalidate();
}

export async function deleteSlide(id: string) {
  const supabase = await createClient();

  const { data: slide } = await supabase
    .from("slides")
    .select("image_desktop_path, image_mobile_path")
    .eq("id", id)
    .single();

  if (slide) {
    await supabase.storage
      .from(BUCKET)
      .remove([slide.image_desktop_path, slide.image_mobile_path]);
  }

  await supabase.from("slides").delete().eq("id", id);
  revalidate();
}
