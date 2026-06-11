"use server";

import { revalidatePath } from "next/cache";
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
  await supabase.from("profiles").update({ role }).eq("id", userId);
  revalidatePath("/admin");
}
