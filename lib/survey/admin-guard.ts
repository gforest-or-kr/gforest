import "server-only";
import { redirect } from "next/navigation";
import { getSessionProfile, type Profile } from "@/lib/auth";

// 질의서 관리자 화면(/portal-admin/survey/<slug>)·CSV 라우트의 가드. 레이아웃은 라우트 핸들러를 감싸지 않으므로
// 페이지와 핸들러가 각자 호출한다. 여기는 UX(리다이렉트)·HTTP 상태 코드용일 뿐이고,
// 데이터 차단은 RLS(survey_* select = is_admin())가 한다 — 다른 곳에 역할 분기를 두지 않는다.

// 페이지용: 비로그인 → 로그인 후 돌아오기(returnTo = 그 설문의 관리자 경로), admin 아님 → 홈.
export async function requireAdminPage(returnTo: string): Promise<Profile> {
  const profile = await getSessionProfile();
  if (!profile) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  if (profile.role !== "admin") redirect("/");
  return profile;
}

// 라우트 핸들러용: 리다이렉트 대신 401/403.
export async function adminForRoute(): Promise<{ ok: true; profile: Profile } | { ok: false; status: 401 | 403 }> {
  const profile = await getSessionProfile();
  if (!profile) return { ok: false, status: 401 };
  if (profile.role !== "admin") return { ok: false, status: 403 };
  return { ok: true, profile };
}
