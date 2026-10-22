// 질의서 제출·임시 저장본 정규화 — 순수 함수(값 import 없음, 입력을 변경하지 않음).
// 브라우저에서 온 모든 값은 신뢰하지 않는다. 허용되는 키는 전부 인자로 받은 문항 정의에서만 나온다
// (질문 id 별 분기 없음 — 문항 변경이 데이터 파일 수정만으로 반영되게).
// 규칙: 정의에 없는 질문/항목/보기 키는 버린다, 문자열은 NUL·제어문자(탭·개행 제외) 제거 후 trim,
// 빈 값은 버린다, 한도를 넘는 문자열은 자르지 않고 버린다(저장값이 사용자가 쓴 것과 몰래 달라지지 않게).
import type {
  Choice,
  Item,
  NormalizedSubmission,
  Question,
  QuestionValue,
  RespondentRole,
  SingleValue,
  TextareaValue,
  ItemValue,
  ValidationResult,
} from "./types";

export const TEXT_MAX = 200;
export const TEXTAREA_MAX = 2000;
export const ROLE_OTHER_MAX = 200;
export const TOTAL_JSON_MAX = 200_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// 자기 소유 속성만 읽는다(__proto__·constructor 같은 상속 키 차단).
// 브라우저(임시 저장 복원)에서도 돌므로 Object.hasOwn 대신 구형 iOS Safari 도 되는 방식.
function own(o: Obj, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}

// NUL·C0 제어문자(탭 9·개행 10 제외)·DEL 제거 — Postgres text/jsonb 는 NUL 을 저장하지 못한다(22P05)
function stripControls(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || (c >= 32 && c !== 127)) out += s[i];
  }
  return out;
}

// 문자열 정리: 문자열이 아니거나, 비었거나, max 를 넘으면 null
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = stripControls(v).trim();
  if (s === "" || s.length > max) return null;
  return s;
}

function findChoice(options: readonly Choice[], key: unknown): Choice | undefined {
  return typeof key === "string" ? options.find((o) => o.key === key) : undefined;
}

// 보기 안 빈칸: 해당 보기가 blank 를 정의할 때만, 숫자 빈칸은 숫자 1~2자리만
function cleanBlank(choice: Choice, v: unknown): string | null {
  if (!choice.blank) return null;
  const s = cleanText(v, TEXT_MAX);
  if (s === null) return null;
  if (choice.blank.num && !/^\d{1,2}$/.test(s)) return null;
  return s;
}

function sanitizeSingle(options: readonly Choice[], raw: unknown): SingleValue | null {
  if (!isObj(raw)) return null;
  const choice = findChoice(options, own(raw, "choice"));
  if (!choice) return null;
  const blank = cleanBlank(choice, own(raw, "blank"));
  return blank === null ? { choice: choice.key } : { choice: choice.key, blank };
}

function sanitizeTextarea(raw: unknown): TextareaValue | null {
  if (!isObj(raw)) return null;
  const text = cleanText(own(raw, "text"), TEXTAREA_MAX);
  return text === null ? null : { text };
}

function sanitizeItem(item: Item, raw: unknown): ItemValue | null {
  switch (item.type) {
    case "single":
      return sanitizeSingle(item.options, raw);
    case "textarea":
      return sanitizeTextarea(raw);
    default:
      return null;
  }
}

function itemKey(item: Item): string | null {
  return "key" in item ? item.key : null;
}

function sanitizeQuestion(q: Question, raw: unknown): QuestionValue | null {
  if (!isObj(raw)) return null;
  const entries = q.items.flatMap((item): [string, ItemValue][] => {
    const key = itemKey(item);
    if (key === null) return [];
    const v = sanitizeItem(item, own(raw, key));
    return v === null ? [] : [[key, v]];
  });
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

export function sanitizeAnswers(raw: unknown, questions: readonly Question[]): Record<string, QuestionValue> {
  if (!isObj(raw)) return {};
  const entries = questions.flatMap((q): [string, QuestionValue][] => {
    const v = sanitizeQuestion(q, own(raw, q.id));
    return v === null ? [] : [[q.id, v]];
  });
  return Object.fromEntries(entries);
}

export function sanitizeRoles(
  rawRoles: unknown,
  rawOther: unknown,
  roles: readonly RespondentRole[],
): { roles: string[]; roleOther: string | null } {
  const picked = new Set(Array.isArray(rawRoles) ? rawRoles.filter((r): r is string => typeof r === "string") : []);
  const kept = roles.filter((r) => picked.has(r.key));
  const hasOther = kept.some((r) => r.other === true);
  return {
    roles: kept.map((r) => r.key),
    roleOther: hasOther ? cleanText(rawOther, ROLE_OTHER_MAX) : null,
  };
}

function buildSubmission(
  raw: unknown,
  questions: readonly Question[],
  roles: readonly RespondentRole[],
): ValidationResult {
  if (!isObj(raw)) return { ok: false, error: "not_object" };
  const id = own(raw, "submissionId");
  if (typeof id !== "string" || !UUID_RE.test(id)) return { ok: false, error: "bad_id" };
  const r = sanitizeRoles(own(raw, "roles"), own(raw, "roleOther"), roles);
  if (r.roles.length === 0) return { ok: false, error: "no_roles" };
  const answers = sanitizeAnswers(own(raw, "answers"), questions);
  if (JSON.stringify(answers).length > TOTAL_JSON_MAX) return { ok: false, error: "too_large" };
  const value: NormalizedSubmission = {
    id: id.toLowerCase(),
    roles: r.roles,
    roleOther: r.roleOther,
    answers: Object.entries(answers).map(([questionId, v]) => ({ questionId, value: v })),
  };
  return { ok: true, value };
}

// 어떤 입력에도 throw 하지 않는다(예상 밖 예외는 "invalid")
export function validateSubmission(
  raw: unknown,
  questions: readonly Question[],
  roles: readonly RespondentRole[],
): ValidationResult {
  try {
    return buildSubmission(raw, questions, roles);
  } catch {
    return { ok: false, error: "invalid" };
  }
}
