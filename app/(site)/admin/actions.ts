"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];
const ROLES: AppRole[] = ["pending", "member", "operator", "teacher", "student", "admin"];

// 역할 변경 — 강제는 RLS(profiles_update) + guard_role_change 트리거(admin 전용),
// 감사 기록은 log_role_change 트리거가 자동 적재
export async function updateRole(userId: string, formData: FormData) {
  const role = String(formData.get("role")) as AppRole;
  if (!ROLES.includes(role)) return;

  const supabase = await createClient();
  // RLS/guard 트리거가 막으면 error 또는 0행 → 조용히 실패하지 않게 결과를 검증하고 알린다
  const { data, error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId)
    .select("id");
  if (error || !data?.length) {
    redirect(`/admin?error=${encodeURIComponent("역할 변경에 실패했습니다. 권한을 확인해 주세요")}`);
  }
  revalidatePath("/admin");
}
