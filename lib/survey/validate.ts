// 질의서 제출·임시 저장본 정규화 — 순수 함수(값 import 없음, 입력을 변경하지 않음, 모듈 상태 없음).
// 브라우저에서 온 모든 값은 신뢰하지 않는다. 허용되는 키는 전부 인자로 받은 문항 정의에서만 나온다
// (질문 id 별 분기 없음 — 문항 변경이 데이터 파일 수정만으로 반영되게).
// 규칙: 정의에 없는 질문/항목/보기 키는 버린다, 문자열은 NUL·제어문자(탭·개행 제외) 제거 후 trim,
// 빈 값은 버린다, 한도를 넘는 문자열은 자르지 않고 버린다(저장값이 사용자가 쓴 것과 몰래 달라지지 않게 —
// 화면이 maxLength 로 막으므로 악의적 입력에서만 생긴다). 값이 하나도 남지 않은 질문은 항목 자체를 만들지 않는다.
import type {
  BoardChoice,
  BoardRow,
  BoardsValue,
  CardDef,
  CardsValue,
  Choice,
  DraftV1,
  Item,
  ItemValue,
  MultiValue,
  NormalizedSubmission,
  Question,
  QuestionValue,
  RespondentRole,
  SingleValue,
  TextareaValue,
  TextValue,
  ValidationResult,
} from "./types";

export const TEXT_MAX = 200;
export const TEXTAREA_MAX = 2000;
export const ROLE_OTHER_MAX = 200;
export const TOTAL_JSON_MAX = 200_000;

const DRAFT_PAGE_MAX = 10; // 쪽 = 절 0..10 (11쪽)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NUM_BLANK_RE = /^\d{1,2}$/;
// NUL·C0 제어문자(탭·개행 제외)·DEL — Postgres text/jsonb 는 NUL 을 저장하지 못한다(22P05)
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F]/g;
// 짝 없는 UTF-16 서로게이트 — jsonb 가 거절한다(22P02). 짝이 맞는 쌍은 그대로 두고 외톨이만 U+FFFD 로 바꾼다
// (String.prototype.toWellFormed 와 같은 결과. 브라우저에서도 돌므로 구형 Safari 에 없는 그 메서드·lookbehind 는 쓰지 않는다)
const SURROGATE_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

function wellFormed(s: string): string {
  return s.replace(SURROGATE_RE, (m) => (m.length === 2 ? m : "\uFFFD"));
}

const BOARD_CHOICES: readonly BoardChoice[] = ["keep", "merge", "drop"];

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// 자기 소유 속성만 읽는다(__proto__·constructor 같은 상속 키 차단).
// 브라우저(임시 저장 복원)에서도 돌므로 Object.hasOwn 대신 구형 iOS Safari 도 되는 방식.
function own(o: Obj, key: string): unknown {
  return Object.prototype.hasOwnProperty.call(o, key) ? o[key] : undefined;
}

function ownObj(o: unknown, key: string): Obj | null {
  if (!isObj(o)) return null;
  const v = own(o, key);
  return isObj(v) ? v : null;
}

// 문자열 정리: 문자열이 아니거나, 비었거나, max 를 넘으면 null
function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const s = wellFormed(v).replace(CONTROL_RE, "").trim();
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
  return choice.blank.num && !NUM_BLANK_RE.test(s) ? null : s;
}

function sanitizeSingle(options: readonly Choice[], raw: unknown): SingleValue | null {
  if (!isObj(raw)) return null;
  const choice = findChoice(options, own(raw, "choice"));
  if (!choice) return null;
  const blank = cleanBlank(choice, own(raw, "blank"));
  return blank === null ? { choice: choice.key } : { choice: choice.key, blank };
}

// 선택은 정의 순서로 정렬·중복 제거, 빈칸은 선택된 보기 중 blank 를 정의한 것만
function sanitizeMulti(options: readonly Choice[], raw: unknown): MultiValue | null {
  if (!isObj(raw)) return null;
  const rawChoices = own(raw, "choices");
  if (!Array.isArray(rawChoices)) return null;
  const picked = new Set(rawChoices.filter((k): k is string => typeof k === "string"));
  const chosen = options.filter((o) => picked.has(o.key));
  if (chosen.length === 0) return null;
  const rawBlanks = own(raw, "blanks");
  const blanks = chosen.flatMap((o): [string, string][] => {
    const b = isObj(rawBlanks) ? cleanBlank(o, own(rawBlanks, o.key)) : null;
    return b === null ? [] : [[o.key, b]];
  });
  const choices = chosen.map((o) => o.key);
  return blanks.length === 0 ? { choices } : { choices, blanks: Object.fromEntries(blanks) };
}

// skip(미정 / 모름)은 항목이 skip 을 정의할 때만, 있으면 글보다 우선
function sanitizeText(allowSkip: boolean, raw: unknown): TextValue | null {
  if (!isObj(raw)) return null;
  if (allowSkip && own(raw, "skip") === true) return { skip: true };
  const text = cleanText(own(raw, "text"), TEXT_MAX);
  return text === null ? null : { text };
}

function sanitizeTextarea(raw: unknown): TextareaValue | null {
  if (!isObj(raw)) return null;
  const text = cleanText(own(raw, "text"), TEXTAREA_MAX);
  return text === null ? null : { text };
}

// 게시판 행: 정의된 행만, choice ∈ keep|merge|drop, target(합칠 대상)은 merge 일 때만
function sanitizeBoards(rows: readonly BoardRow[], raw: unknown): BoardsValue | null {
  const rawRows = ownObj(raw, "rows");
  if (rawRows === null) return null;
  const entries = rows.flatMap((row): [string, BoardsValue["rows"][string]][] => {
    const r = ownObj(rawRows, row.key);
    const choice = r ? BOARD_CHOICES.find((c) => c === own(r, "choice")) : undefined;
    if (!r || !choice) return [];
    const target = choice === "merge" ? cleanText(own(r, "target"), TEXT_MAX) : null;
    return [[row.key, target === null ? { choice } : { choice, target }]];
  });
  return entries.length === 0 ? null : { rows: Object.fromEntries(entries) };
}

// 카드: 정의된 카드만, purpose(용도)·choice(그 카드의 보기)·blank(blank 정의 보기일 때만)
function sanitizeCard(card: CardDef, raw: Obj): CardsValue[string] | null {
  const purpose = cleanText(own(raw, "purpose"), TEXT_MAX);
  const choice = findChoice(card.options, own(raw, "choice"));
  const blank = choice ? cleanBlank(choice, own(raw, "blank")) : null;
  if (purpose === null && !choice) return null;
  return {
    ...(purpose === null ? {} : { purpose }),
    ...(choice ? { choice: choice.key } : {}),
    ...(blank === null ? {} : { blank }),
  };
}

function sanitizeCards(cards: readonly CardDef[], raw: unknown): CardsValue | null {
  const entries = cards.flatMap((card): [string, CardsValue[string]][] => {
    const c = ownObj(raw, card.key);
    const v = c ? sanitizeCard(card, c) : null;
    return v === null ? [] : [[card.key, v]];
  });
  return entries.length === 0 ? null : Object.fromEntries(entries);
}

function sanitizeItem(item: Item, raw: unknown): ItemValue | null {
  switch (item.type) {
    case "single":
      return sanitizeSingle(item.options, raw);
    case "multi":
      return sanitizeMulti(item.options, raw);
    case "text":
      return sanitizeText(item.skip === true, raw);
    case "textarea":
      return sanitizeTextarea(raw);
    case "boards":
      return sanitizeBoards(item.rows, raw);
    case "cards":
      return sanitizeCards(item.cards, raw);
    case "leader-list":
    case "note":
      return null; // 읽기 전용 — 값 없음
  }
}

function sanitizeQuestion(q: Question, raw: unknown): QuestionValue | null {
  if (!isObj(raw)) return null;
  const entries = q.items.flatMap((item): [string, ItemValue][] => {
    if (!("key" in item)) return [];
    const v = sanitizeItem(item, own(raw, item.key));
    return v === null ? [] : [[item.key, v]];
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

// 역할: 정의된 키만, 정의 순서로, 중복 제거. 기타 직접 입력은 기타를 골랐을 때만
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

// 오류 코드: not_object | bad_id | no_roles | too_large (예상 밖 예외는 invalid). 어떤 입력에도 throw 하지 않는다.
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

function clampPage(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.min(DRAFT_PAGE_MAX, Math.max(0, Math.trunc(v)));
}

// localStorage 임시 저장본 복원. 문항이 바뀌어 낡은 키가 있어도 제출과 같은 정규화로 걸러진다.
// 깨졌거나 버전이 다르면 null(빈 폼으로 시작).
export function parseDraft(
  raw: string | null,
  questions: readonly Question[],
  roles: readonly RespondentRole[],
): DraftV1 | null {
  if (typeof raw !== "string") return null;
  try {
    const d: unknown = JSON.parse(raw);
    if (!isObj(d) || own(d, "v") !== 1) return null;
    const r = sanitizeRoles(own(d, "roles"), own(d, "roleOther"), roles);
    return {
      v: 1,
      savedAt: cleanText(own(d, "savedAt"), 64) ?? "",
      page: clampPage(own(d, "page")),
      roles: r.roles,
      roleOther: r.roleOther ?? "",
      answers: sanitizeAnswers(own(d, "answers"), questions),
    };
  } catch {
    return null;
  }
}
