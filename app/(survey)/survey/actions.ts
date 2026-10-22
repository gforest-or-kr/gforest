"use server";

import { randomUUID } from "node:crypto";
import { cookies, headers } from "next/headers";
import { pgCode, withUser } from "@/lib/db";
import { formatKst, surveyClosedNow } from "@/lib/survey/config";
import { BID_COOKIE, BID_COOKIE_MAX_AGE_S, clientIp, getHashKey, hmacHex } from "@/lib/survey/hash";
import { QUESTIONS, RESPONDENT_ROLES } from "@/lib/survey/questions";
import { insertResponse } from "@/lib/survey/store";
import { validateSubmission } from "@/lib/survey/validate";

export type SubmitResult =
  | { ok: true }
  | { ok: false; reason: "closed"; closedAtLabel: string }
  | { ok: false; reason: "invalid" | "error" };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// 질의서 제출. 로그인 상태여도 항상 익명(anon) 컨텍스트로 저장 — 응답에 사용자 id 를 남기지 않는다.
// 같은 제출 id 재전송(재시도·더블클릭)은 store 가 "duplicate" 로 알려 주며 성공으로 취급한다(멱등).
// 중복 제출은 막지 않는다: 브라우저 쿠키 id·IP 의 HMAC 만 남겨 관리자 화면에서 '중복 의심'으로 묶는다.
// 예상 가능한 실패는 throw 하지 않고 값으로 돌려준다. 로그에는 오류 코드만(응답 내용·IP·쿠키 금지).
export async function submitSurvey(raw: unknown): Promise<SubmitResult> {
  // 마감 판정이 맨 먼저 — 오래 열어 둔 페이지에서 보낸 제출도 거절한다(쿠키·DB 를 건드리지 않음).
  const { closed, closesAt } = surveyClosedNow();
  if (closed) return { ok: false, reason: "closed", closedAtLabel: formatKst(closesAt.ms) };

  const v = validateSubmission(raw, QUESTIONS, RESPONDENT_ROLES);
  if (!v.ok) return { ok: false, reason: "invalid" };

  const jar = await cookies();
  const existing = jar.get(BID_COOKIE)?.value;
  const bid = existing !== undefined && UUID_RE.test(existing) ? existing : randomUUID();
  const ip = clientIp(await headers());
  const key = getHashKey();
  const hashes = key
    ? { browser: hmacHex(key, "bid", bid), ip: ip ? hmacHex(key, "ip", ip) : null }
    : { browser: null, ip: null };

  try {
    await withUser(null, (c) => insertResponse(c, { ...v.value, hashes }));
  } catch (e) {
    console.error("[survey] submit failed", pgCode(e) ?? "unknown");
    return { ok: false, reason: "error" };
  }

  // 존재 = "이 브라우저는 제출했다"(재방문 안내). 액션 POST 는 /survey 로 가므로 path 를 좁힌다.
  jar.set(BID_COOKIE, bid, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/survey",
    maxAge: BID_COOKIE_MAX_AGE_S,
  });
  return { ok: true };
}
