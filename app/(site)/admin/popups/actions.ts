"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";

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

  // RLS 거부(42501)는 예외로 — 기존과 같이 조용히 무시하지 않고 그대로 전파
  await withUser(await getSessionUserId(), (c) =>
    c.query(
      `insert into popups (title, body, link_url, dismiss_days, sort_order, is_active, ends_at, starts_at)
       values ($1, $2, $3, $4, $5, $6, $7::timestamptz, coalesce($8::timestamptz, now()))`,
      [
        title,
        String(formData.get("body") ?? ""),
        String(formData.get("link_url") ?? "").trim() || null,
        clampDismiss(formData.get("dismiss_days")),
        Number(formData.get("sort_order") ?? 0) || 0,
        formData.get("is_active") === "on",
        endsAt,
        startsAt,
      ],
    ),
  );

  revalidate();
}

export async function updatePopup(id: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const startsAt = localToIso(String(formData.get("starts_at") ?? ""));
  const endsAt = localToIso(String(formData.get("ends_at") ?? ""));
  if (!endsAt) return;
  if (startsAt && endsAt < startsAt) return;

  // RLS가 막으면 0행(무시 — 기존 동작과 동일)
  await withUser(await getSessionUserId(), (c) =>
    c.query(
      `update popups
          set title = $1, body = $2, link_url = $3, dismiss_days = $4, sort_order = $5, is_active = $6,
              ends_at = $7::timestamptz, starts_at = coalesce($8::timestamptz, starts_at)
        where id = $9`,
      [
        title,
        String(formData.get("body") ?? ""),
        String(formData.get("link_url") ?? "").trim() || null,
        clampDismiss(formData.get("dismiss_days")),
        Number(formData.get("sort_order") ?? 0) || 0,
        formData.get("is_active") === "on",
        endsAt,
        startsAt,
        id,
      ],
    ),
  );

  revalidate();
}

export async function deletePopup(id: string) {
  await withUser(await getSessionUserId(), (c) => c.query("delete from popups where id = $1", [id]));
  revalidate();
}
