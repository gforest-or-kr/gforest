// 질의서 응답 CSV — 순수 모듈. 엑셀 한글용 UTF-8 BOM, CRLF, 모든 셀 따옴표.
// 수식 주입 방어(OWASP CSV Injection): 사용자가 쓴 셀이 = + - @ 탭 CR LF(전각 ＝ ＋ － ＠ 포함)로
// 시작하면 앞에 ' 를 붙인다. 우리가 만든 값(번호·라벨·시각)은 건드리지 않는다.
// 열은 문항 데이터(QUESTIONS)에서 펼친다 — 문항을 고치면 코드 수정 없이 열이 바뀐다.
import { DUP_REASON_LABEL, roleLabels, type DupInfo, type DupMap } from "./aggregate";
import { formatKstCompact } from "./config";
import type { AdminAnswerRow, AdminResponseRow, Question, RespondentRole } from "./types";

const RISKY_START = /^[=+\-@\t\r\n＝＋－＠]/;

export function csvCell(v: string, userInput: boolean): string {
  const s = userInput && RISKY_START.test(v) ? `'${v}` : v;
  return `"${s.replace(/"/g, '""')}"`;
}

// 셀은 이미 csvCell 을 거친 문자열
export function toCsv(rows: readonly (readonly string[])[]): string {
  return "﻿" + rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
}

export interface CsvRowCtx {
  response: AdminResponseRow;
  answers: ReadonlyMap<string, unknown>; // question id → value
  dup: DupInfo | undefined;
}

export interface CsvColumn {
  header: string;
  get(ctx: CsvRowCtx): string;
  userInput: boolean;
}

function baseColumns(roles: readonly RespondentRole[]): CsvColumn[] {
  return [
    { header: "응답 번호", userInput: false, get: (x) => String(x.response.no) },
    { header: "제출 시각(KST)", userInput: false, get: (x) => formatKstCompact(x.response.submittedAt) },
    { header: "응답자 구분", userInput: false, get: (x) => roleLabels(x.response.roles, roles) },
    { header: "응답자 구분 기타 입력", userInput: true, get: (x) => x.response.roleOther ?? "" },
    { header: "중복 의심", userInput: false, get: (x) => (x.dup ? "Y" : "N") },
    { header: "중복 묶음 번호", userInput: false, get: (x) => (x.dup ? String(x.dup.group) : "") },
    { header: "중복 사유", userInput: false, get: (x) => (x.dup ? DUP_REASON_LABEL[x.dup.reason] : "") },
  ];
}

export function csvColumns(questions: readonly Question[], roles: readonly RespondentRole[]): CsvColumn[] {
  void questions; // 문항별 열은 다음 단계에서 펼친다(지금은 기본 7열)
  return baseColumns(roles);
}

function answersByResponse(answers: readonly AdminAnswerRow[]): Map<string, Map<string, unknown>> {
  const out = new Map<string, Map<string, unknown>>();
  for (const a of answers) {
    const m = out.get(a.responseId) ?? new Map<string, unknown>();
    m.set(a.questionId, a.value);
    out.set(a.responseId, m);
  }
  return out;
}

// 모든 응답(집계 기준 토글과 무관), 응답 번호 순.
export function buildCsv(
  questions: readonly Question[],
  roles: readonly RespondentRole[],
  rows: readonly AdminResponseRow[],
  answers: readonly AdminAnswerRow[],
  dup: DupMap,
): string {
  const cols = csvColumns(questions, roles);
  const byResponse = answersByResponse(answers);
  const empty = new Map<string, unknown>();
  const body = [...rows]
    .sort((a, b) => a.no - b.no)
    .map((response) => {
      const ctx: CsvRowCtx = { response, answers: byResponse.get(response.id) ?? empty, dup: dup.get(response.id) };
      return cols.map((c) => csvCell(c.get(ctx), c.userInput));
    });
  return toCsv([cols.map((c) => csvCell(c.header, false)), ...body]);
}
