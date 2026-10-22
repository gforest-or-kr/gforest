import "server-only";
import { pgCode, type DbClient } from "@/lib/db";
import type { AdminAnswerRow, AdminResponseRow, NormalizedSubmission } from "./types";

// 질의서 응답 저장·조회. 트랜잭션은 호출 측이 소유한다(익명 제출 = withUser(null, …)).
// 익명은 SELECT 정책(admin 전용)을 통과하지 못하므로 insert 가 행을 되돌려 받는 형태도,
// `on conflict` 도 쓸 수 없다 — 둘 다 SELECT 정책 검사를 거쳐 42501 이 난다(로컬 Postgres 17 실측).
// 그래서 응답 id 는 클라이언트가 만든 제출 id 를 PK 로 넣고, 재전송은 PK 충돌(23505)로 알아낸다.

export type NewResponse = NormalizedSubmission & {
  hashes: { browser: string | null; ip: string | null };
};

// 같은 제출 id 재전송(더블클릭·재시도)은 "duplicate" — 호출 측은 성공으로 취급(멱등).
// 23505 는 첫 문장에서만 날 수 있으므로 이후 문장이 없다. 트랜잭션은 aborted 상태가 되지만
// withUser 의 commit 은 aborted 트랜잭션에서 rollback 으로 끝난다(저장된 것 없음 = 기존 행 유지).
export async function insertResponse(c: DbClient, r: NewResponse): Promise<"created" | "duplicate"> {
  try {
    await c.query("insert into survey_responses (id, respondent_roles, respondent_other) values ($1, $2::text[], $3)", [
      r.id,
      r.roles,
      r.roleOther,
    ]);
  } catch (e) {
    if (pgCode(e) === "23505") return "duplicate";
    throw e;
  }
  await c.query("insert into survey_response_hashes (response_id, browser_hash, ip_hash) values ($1, $2, $3)", [
    r.id,
    r.hashes.browser,
    r.hashes.ip,
  ]);
  // 질문 ≤ 28개 — 행마다 파라미터 쿼리로 충분
  for (const a of r.answers) {
    await c.query("insert into survey_answers (response_id, question_id, value) values ($1, $2, $3::jsonb)", [
      r.id,
      a.questionId,
      JSON.stringify(a.value),
    ]);
  }
  return "created";
}

interface ResponseDbRow {
  id: string;
  no: number;
  submitted_at: string | Date;
  respondent_roles: string[];
  respondent_other: string | null;
  browser_hash: string | null;
  ip_hash: string | null;
}

interface AnswerDbRow {
  response_id: string;
  question_id: string;
  value: unknown;
}

// 관리자 집계·CSV 용 전량 조회(수백 건 규모). 호출 측이 withUser(관리자 id, …) 를 소유하고,
// 관리자가 아니면 RLS 가 0행을 돌려준다 — 앱에서 권한을 다시 판정하지 않는다.
export async function loadAdminRows(
  c: DbClient,
): Promise<{ responses: AdminResponseRow[]; answers: AdminAnswerRow[] }> {
  const r = await c.query<ResponseDbRow>(
    `select r.id, r.response_no::int4 as no, r.submitted_at, r.respondent_roles, r.respondent_other,
            h.browser_hash, h.ip_hash
       from survey_responses r
       left join survey_response_hashes h on h.response_id = r.id
      order by r.response_no`,
  );
  const a = await c.query<AnswerDbRow>("select response_id, question_id, value from survey_answers");
  return {
    responses: r.rows.map((row) => ({
      id: row.id,
      no: row.no,
      submittedAt: new Date(row.submitted_at).toISOString(), // lib/db 파서(ISO 문자열)·raw pg(Date) 둘 다
      roles: row.respondent_roles,
      roleOther: row.respondent_other,
      browserHash: row.browser_hash,
      ipHash: row.ip_hash,
    })),
    answers: a.rows.map((row) => ({ responseId: row.response_id, questionId: row.question_id, value: row.value })),
  };
}
