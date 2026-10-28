import { pgCode, withUser } from "@/lib/db";
import { dupGroups } from "@/lib/survey/aggregate";
import { adminForRoute } from "@/lib/survey/admin-guard";
import { kstDateStamp } from "@/lib/survey/config";
import { buildCsv } from "@/lib/survey/csv";
import { loadAdminRows } from "@/lib/survey/store";
import { getSurvey } from "@/lib/survey/surveys";

// 질의서 응답 CSV 내려받기(관리자, /portal-admin/survey/<slug>/export). 라우트 핸들러는 레이아웃을 거치지 않으므로 여기서 직접 가드한다.
// 데이터는 관리자 id 의 RLS 컨텍스트로만 읽는다. 브라우저·프록시 캐시 금지(no-store).
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function fileName(slug: string, nowMs: number): string {
  return `survey-${slug}-${kstDateStamp(nowMs)}.csv`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  const def = getSurvey((await params).slug);
  if (!def) return new Response("Not Found", { status: 404, headers: NO_STORE });

  const guard = await adminForRoute();
  if (!guard.ok) {
    return new Response(guard.status === 401 ? "Unauthorized" : "Forbidden", {
      status: guard.status,
      headers: NO_STORE,
    });
  }

  let data: Awaited<ReturnType<typeof loadAdminRows>>;
  try {
    data = await withUser(guard.profile.id, (c) => loadAdminRows(c, def.slug));
  } catch (e) {
    console.error("[survey-admin] export failed", pgCode(e) ?? "unknown"); // 내용·SQL 은 남기지 않는다
    return new Response("결과를 불러오지 못했어요.", {
      status: 500,
      headers: { ...NO_STORE, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const csv = buildCsv(def.questions, def.roles, data.responses, data.answers, dupGroups(data.responses));
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(def.slug, Date.now())}"`,
    },
  });
}
