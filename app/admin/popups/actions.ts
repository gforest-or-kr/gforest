"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// 권한 강제는 popups_admin RLS에 위임(CLAUDE.md #3). 액션은 입력 검증만 담당한다.
// 이미지(popups.image_path)는 현 표시 레이어가 렌더링하지 않으므로 다루지 않는다(#10 범위 제외).

function revalidate() {
  revalidatePath("/admin/popups");
  revalidatePath("/");
}

// datetime-local(KST 벽시계 "YYYY-MM-DDTHH:mm") → timestamptz(UTC ISO).
// KST는 UTC+9 고정(DST 없음). 빈 값은 null(컬럼 기본값 now()에 위임).
function localToIso(value: string): string | null {
  if (!value) return null;
  const t = Date.parse(`${value}:00+09:00`);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

// 1–30 범위로 clamp, 숫자가 아니면 기본 3.
function clampDismiss(raw: FormDataEntryValue | null): number {
  const n = Math.floor(Number(raw));
  if (!Number.isFinite(n)) return 3;
  return Math.min(30, Math.max(1, n));
}

export async function createPopup(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startsAt = localToIso(String(formData.get("starts_at") ?? ""));
  const endsAt = localToIso(String(formData.get("ends_at") ?? ""));
  if (!endsAt) return; // 노출 종료는 필수
  if (startsAt && endsAt < startsAt) return; // 종료가 시작보다 빠른 기간 거부

  const supabase = await createClient();
  await supabase.from("popups").insert({
    title,
    body: String(formData.get("body") ?? ""),
    link_url: String(formData.get("link_url") ?? "").trim() || null,
    dismiss_days: clampDismiss(formData.get("dismiss_days")),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
    is_active: formData.get("is_active") === "on",
    ends_at: endsAt,
    ...(startsAt ? { starts_at: startsAt } : {}),
  });

  revalidate();
}

export async function updatePopup(id: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startsAt = localToIso(String(formData.get("starts_at") ?? ""));
  const endsAt = localToIso(String(formData.get("ends_at") ?? ""));
  if (!endsAt) return;
  if (startsAt && endsAt < startsAt) return;

  const supabase = await createClient();
  await supabase
    .from("popups")
    .update({
      title,
      body: String(formData.get("body") ?? ""),
      link_url: String(formData.get("link_url") ?? "").trim() || null,
      dismiss_days: clampDismiss(formData.get("dismiss_days")),
      sort_order: Number(formData.get("sort_order") ?? 0) || 0,
      is_active: formData.get("is_active") === "on",
      ends_at: endsAt,
      ...(startsAt ? { starts_at: startsAt } : {}),
    })
    .eq("id", id);

  revalidate();
}

export async function deletePopup(id: string) {
  const supabase = await createClient();
  await supabase.from("popups").delete().eq("id", id);
  revalidate();
}
