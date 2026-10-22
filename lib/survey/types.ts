// 이해관계자 웹 질의서 — 문항 정의·응답 값·제출 계약 (type 만 export).
// 문항 데이터(questions.ts)·검증기(validate.ts)·저장(store.ts)·화면이 모두 이 계약을 쓴다.
// 순수 TS 타입만 둔다(enum·namespace 금지) — Node type-stripping 으로 검증 스크립트가 직접 import 한다.

export interface RespondentRole {
  key: string;
  label: string;
  other?: true; // 기타: 직접 입력칸을 함께 받는다
}

export interface Section {
  no: number;
  title: string;
}

export interface Blank {
  label: string;
  post?: string; // 입력칸 뒤 글자(예: "년 이내")
  num?: true; // 숫자만, 최대 2자리
}

export interface Choice {
  key: string; // 'o1'.. 리터럴 — 한 번 정하면 재사용·변경 금지
  label: string;
  blank?: Blank;
}

export type BoardAccess = "public" | "login" | "restricted";

export interface BoardRow {
  key: string;
  name: string;
  who: string;
  posts: string;
  recent: string;
  note?: string;
  access: BoardAccess;
}

export interface CardDef {
  key: string;
  name: string;
  meta: string;
  purposeLabel: string;
  options: Choice[];
}

export type Item =
  | { type: "single"; key: string; title?: string; options: Choice[] }
  | { type: "multi"; key: string; title?: string; options: Choice[] }
  | { type: "text"; key: string; label: string; skip?: true }
  | { type: "textarea"; key: string; label: string; rows?: number }
  | { type: "boards"; key: string; rows: BoardRow[] }
  | { type: "cards"; key: string; cards: CardDef[] }
  | { type: "leader-list"; head: [string, string]; unit?: string; rows: { label: string; value: string }[] }
  | { type: "note"; text: string; tone?: "warn" };

export interface Question {
  id: string;
  no: number | null; // 10절 자유 의견은 번호 없음
  section: number;
  title: string;
  lead?: string[];
  items: Item[];
}

// ---- 저장 값 모양 (질문 1개 = { [itemKey]: ItemValue }) ----

export interface SingleValue {
  choice: string;
  blank?: string;
}

export interface MultiValue {
  choices: string[];
  blanks?: Record<string, string>;
}

export type TextValue = { text: string } | { skip: true };

export interface TextareaValue {
  text: string;
}

export type BoardChoice = "keep" | "merge" | "drop";

export interface BoardsValue {
  rows: Record<string, { choice: BoardChoice; target?: string }>;
}

export type CardsValue = Record<string, { purpose?: string; choice?: string; blank?: string }>;

export type ItemValue = SingleValue | MultiValue | TextValue | TextareaValue | BoardsValue | CardsValue;

export type QuestionValue = Record<string, ItemValue>;

// ---- 제출·임시 저장·관리자 조회 ----

export interface NormalizedSubmission {
  id: string;
  roles: string[];
  roleOther: string | null;
  answers: { questionId: string; value: QuestionValue }[];
}

export type ValidationResult = { ok: true; value: NormalizedSubmission } | { ok: false; error: string };

export interface DraftV1 {
  v: 1;
  savedAt: string;
  page: number;
  roles: string[];
  roleOther: string;
  answers: Record<string, QuestionValue>;
}

export interface AdminResponseRow {
  id: string;
  no: number;
  submittedAt: string;
  roles: string[];
  roleOther: string | null;
  browserHash: string | null;
  ipHash: string | null;
}

export interface AdminAnswerRow {
  responseId: string;
  questionId: string;
  value: unknown;
}
