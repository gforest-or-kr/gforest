// 질의서 응답 CSV — 순수 모듈. 엑셀 한글용 UTF-8 BOM, CRLF, 모든 셀 따옴표.
// 수식 주입 방어(OWASP CSV Injection): 사용자가 쓴 셀이 = + - @ 탭 CR LF(전각 ＝ ＋ － ＠ 포함)로
// 시작하면 앞에 ' 를 붙인다. 우리가 만든 값(번호·라벨·시각)은 건드리지 않는다.
// 열은 문항 데이터(QUESTIONS)에서 펼친다 — 문항을 고치면 코드 수정 없이 열이 바뀐다.
import { DUP_REASON_LABEL, plainLabel, roleLabels, SKIP_LABEL, type DupInfo, type DupMap } from "./aggregate";
import { formatKstCompact } from "./config";
import { itemValue, readBoards, readCards, readMulti, readSingle, readText } from "./read-values";
import type { AdminAnswerRow, AdminResponseRow, BoardChoice, Choice, Item, Question, RespondentRole } from "./types";

const RISKY_START = /^[=+\-@\t\r\n＝＋－＠]/;

export function csvCell(v: string, userInput: boolean): string {
  const s = userInput && RISKY_START.test(v) ? `'${v}` : v;
  return `"${s.replace(/"/g, '""')}"`;
}

// 셀은 이미 csvCell 을 거친 문자열
export function toCsv(rows: readonly (readonly string[])[]): string {
  return "\uFEFF" + rows.map((r) => r.join(",")).join("\r\n") + "\r\n";
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

// ---- 문항별 열 (item 종류로만 갈린다 — 문항 id 분기 없음) ----

const TITLE_CHARS = 20;
const BOARD_LABEL: Readonly<Record<BoardChoice, string>> = { keep: "유지", merge: "통합", drop: "폐지" };

// "Q12 학교 유튜브·인스타그램 내용을 새 홈" — 번호 없는 질문(자유 의견)은 머리말 없이 항목 제목만
function questionPrefix(q: Question): string {
  return q.no === null ? "" : `Q${q.no} ${[...q.title].slice(0, TITLE_CHARS).join("").trim()}`;
}

function header(prefix: string, ...parts: (string | null | undefined)[]): string {
  return [prefix, ...parts].filter((p): p is string => typeof p === "string" && p !== "").join(" · ");
}

const optionLabel = (options: readonly Choice[], key: string) => options.find((o) => o.key === key)?.label ?? key;

type ValueOf = (ctx: CsvRowCtx) => unknown;

function singleColumns(item: Extract<Item, { type: "single" }>, h: string, value: ValueOf): CsvColumn[] {
  const main: CsvColumn = {
    header: h,
    userInput: false,
    get: (x) => {
      const v = readSingle(value(x));
      return v ? optionLabel(item.options, v.choice) : "";
    },
  };
  const blank: CsvColumn = {
    header: `${h} (직접 쓴 값)`,
    userInput: true,
    get: (x) => readSingle(value(x))?.blank ?? "",
  };
  return item.options.some((o) => o.blank !== undefined) ? [main, blank] : [main];
}

function multiColumns(item: Extract<Item, { type: "multi" }>, h: string, value: ValueOf): CsvColumn[] {
  const main: CsvColumn = {
    header: h,
    userInput: false,
    get: (x) => (readMulti(value(x))?.choices ?? []).map((k) => optionLabel(item.options, k)).join(" / "),
  };
  const blanks: CsvColumn = {
    header: `${h} (직접 쓴 값)`,
    userInput: true,
    get: (x) => {
      const v = readMulti(value(x));
      if (!v) return "";
      return v.choices.flatMap((k) => (v.blanks[k] ? [`${optionLabel(item.options, k)}: ${v.blanks[k]}`] : [])).join(" / ");
    },
  };
  return item.options.some((o) => o.blank !== undefined) ? [main, blanks] : [main];
}

function textColumn(h: string, value: ValueOf): CsvColumn {
  return {
    header: h,
    userInput: true,
    get: (x) => {
      const v = readText(value(x));
      return v === null ? "" : "skip" in v ? SKIP_LABEL : v.text;
    },
  };
}

function boardColumns(item: Extract<Item, { type: "boards" }>, prefix: string, value: ValueOf): CsvColumn[] {
  return item.rows.map((row) => ({
    header: header(prefix, row.name),
    userInput: true, // 통합 대상(사용자 글)이 들어간다
    get: (x: CsvRowCtx) => {
      const v = readBoards(value(x))[row.key];
      if (!v) return "";
      return v.choice === "merge" && v.target ? `통합→${v.target}` : BOARD_LABEL[v.choice];
    },
  }));
}

function cardColumns(item: Extract<Item, { type: "cards" }>, prefix: string, value: ValueOf): CsvColumn[] {
  return item.cards.flatMap((card) => [
    {
      header: header(prefix, card.name, "용도"),
      userInput: true,
      get: (x: CsvRowCtx) => readCards(value(x))[card.key]?.purpose ?? "",
    },
    {
      header: header(prefix, card.name, "처리"),
      userInput: true, // 빈칸(사용자 글)이 괄호로 들어간다
      get: (x: CsvRowCtx) => {
        const c = readCards(value(x))[card.key];
        if (!c?.choice) return "";
        const label = optionLabel(card.options, c.choice);
        return c.blank ? `${label}(${c.blank})` : label;
      },
    },
  ]);
}

function itemColumns(q: Question, item: Item): CsvColumn[] {
  if (item.type === "leader-list" || item.type === "note") return []; // 값 없음
  const prefix = questionPrefix(q);
  const value: ValueOf = (x) => itemValue(x.answers.get(q.id), item.key);
  switch (item.type) {
    case "single":
      return singleColumns(item, header(prefix, item.title), value);
    case "multi":
      return multiColumns(item, header(prefix, item.title), value);
    case "text":
    case "textarea":
      return [textColumn(header(prefix, plainLabel(item.label)), value)];
    case "boards":
      return boardColumns(item, prefix, value);
    case "cards":
      return cardColumns(item, prefix, value);
  }
}

export function csvColumns(questions: readonly Question[], roles: readonly RespondentRole[]): CsvColumn[] {
  return [...baseColumns(roles), ...questions.flatMap((q) => q.items.flatMap((item) => itemColumns(q, item)))];
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
