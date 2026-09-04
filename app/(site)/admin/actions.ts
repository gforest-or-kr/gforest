"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { withUser } from "@/lib/db";
import type { Database } from "@/lib/db/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ROLES: AppRole[] = ["pending", "member", "operator", "teacher", "student", "admin"];

// 역할 변경 — 강제는 RLS(profiles_update) + guard_role_change 트리거(admin 전용),
// 감사 기록은 log_role_change 트리거가 자동 적재
export async function updateRole(userId: string, formData: FormData) {
  const role = String(formData.get("role")) as AppRole;
  if (!ROLES.includes(role)) return;

  // RLS/guard 트리거가 막으면 예외 또는 0행 → 조용히 실패하지 않게 결과를 검증하고 알린다
  const adminId = await getSessionUserId();
  let ok = false;
  try {
    ok = await withUser(adminId, async (c) => {
      const r = await c.query("update profiles set role = $1 where id = $2", [role, userId]);
      return (r.rowCount ?? 0) > 0;
    });
  } catch {
    ok = false;
  }
  if (!ok) {
    redirect(`/admin?error=${encodeURIComponent("역할 변경에 실패했습니다. 권한을 확인해 주세요")}`);
  }
  revalidatePath("/admin");
}
