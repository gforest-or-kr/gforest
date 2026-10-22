"use server";

import { pgCode, withUser } from "@/lib/db";
import { QUESTIONS, RESPONDENT_ROLES } from "@/lib/survey/questions";
import { insertResponse } from "@/lib/survey/store";
import { validateSubmission } from "@/lib/survey/validate";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "closed"; closedAtLabel: string }
  | { ok: false; reason: "invalid" | "error" };

// 질의서 제출. 로그인 상태여도 항상 익명(anon) 컨텍스트로 저장 — 응답에 사용자 id 를 남기지 않는다.
// 같은 제출 id 재전송(재시도·더블클릭)은 store 가 "duplicate" 로 알려 주며 성공으로 취급한다(멱등).
// 예상 가능한 실패는 throw 하지 않고 값으로 돌려준다. 로그에는 오류 코드만(응답 내용·IP·쿠키 금지).
export async function submitSurvey(raw: unknown): Promise<SubmitResult> {
  const v = validateSubmission(raw, QUESTIONS, RESPONDENT_ROLES);
  if (!v.ok) return { ok: false, reason: "invalid" };

  try {
    await withUser(null, (c) => insertResponse(c, { ...v.value, hashes: { browser: null, ip: null } }));
  } catch (e) {
    console.error("[survey] submit failed", pgCode(e) ?? "unknown");
    return { ok: false, reason: "error" };
  }
  return { ok: true };
}
