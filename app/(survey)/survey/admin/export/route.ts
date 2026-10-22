import { pgCode, withUser } from "@/lib/db";
import { dupGroups } from "@/lib/survey/aggregate";
import { adminForRoute } from "@/lib/survey/admin-guard";
import { kstDateStamp } from "@/lib/survey/config";
import { buildCsv } from "@/lib/survey/csv";
import { QUESTIONS, RESPONDENT_ROLES } from "@/lib/survey/questions";
import { loadAdminRows } from "@/lib/survey/store";

// 질의서 응답 CSV 내려받기(관리자). 라우트 핸들러는 레이아웃을 거치지 않으므로 여기서 직접 가드한다.
// 데이터는 관리자 id 의 RLS 컨텍스트로만 읽는다. 브라우저·프록시 캐시 금지(no-store).
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fileName(nowMs: number): string {
  return `survey-responses-${kstDateStamp(nowMs)}.csv`;
}

export async function GET(): Promise<Response> {
  const guard = await adminForRoute();
  if (!guard.ok) {
    return new Response(guard.status === 401 ? "Unauthorized" : "Forbidden", {
      status: guard.status,
      headers: NO_STORE,
    });
  }

  let data: Awaited<ReturnType<typeof loadAdminRows>>;
  try {
    data = await withUser(guard.profile.id, loadAdminRows);
  } catch (e) {
    console.error("[survey-admin] export failed", pgCode(e) ?? "unknown"); // 내용·SQL 은 남기지 않는다
    return new Response("결과를 불러오지 못했어요.", {
      status: 500,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const csv = buildCsv(QUESTIONS, RESPONDENT_ROLES, data.responses, data.answers, dupGroups(data.responses));
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(Date.now())}"`,
    },
  });
}
