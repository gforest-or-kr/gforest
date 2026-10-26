// 질의서 저장 값 읽기 — 관리자 집계(aggregate.ts)·CSV(csv.ts) 공용 순수 모듈.
import type { BoardChoice } from "./types";

// 값은 검증기를 거쳐 저장되지만 DB 에서 온 unknown 이므로 모양을 다시 확인하고, 맞지 않으면 "응답 없음"으로 본다.

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: Obj, k: string): unknown => (Object.prototype.hasOwnProperty.call(o, k) ? o[k] : undefined);
const optStr = (v: unknown): string | undefined => (typeof v === "string" && v !== "" ? v : undefined);

export interface SingleRead {
  choice: string;
  blank?: string;
}
export interface MultiRead {
  choices: string[];
  blanks: Record<string, string>;
}
export type TextRead = { text: string } | { skip: true };
export type BoardsRead = Record<string, { choice: BoardChoice; target?: string }>;
export type CardsRead = Record<string, { purpose?: string; choice?: string; blank?: string }>;

const BOARD_CHOICES: readonly BoardChoice[] = ["keep", "merge", "drop"];

export function itemValue(questionValue: unknown, key: string): unknown {
  return isObj(questionValue) ? own(questionValue, key) : undefined;
}

export function readSingle(v: unknown): SingleRead | null {
  if (!isObj(v)) return null;
  const choice = optStr(own(v, "choice"));
  if (choice === undefined) return null;
  const blank = optStr(own(v, "blank"));
  return blank === undefined ? { choice } : { choice, blank };
}

export function readMulti(v: unknown): MultiRead | null {
  if (!isObj(v)) return null;
  const raw = own(v, "choices");
  const choices = Array.isArray(raw) ? raw.filter((c): c is string => typeof c === "string") : [];
  if (choices.length === 0) return null;
  const rawBlanks = own(v, "blanks");
  const blanks = isObj(rawBlanks)
    ? Object.fromEntries(Object.entries(rawBlanks).filter((e): e is [string, string] => typeof e[1] === "string"))
    : {};
  return { choices, blanks };
}

export function readText(v: unknown): TextRead | null {
  if (!isObj(v)) return null;
  if (own(v, "skip") === true) return { skip: true };
  const text = optStr(own(v, "text"));
  return text === undefined ? null : { text };
}

export function readBoards(v: unknown): BoardsRead {
  const rows = isObj(v) ? own(v, "rows") : undefined;
  if (!isObj(rows)) return {};
  const out: BoardsRead = {};
  for (const [k, r] of Object.entries(rows)) {
    const choice = isObj(r) ? own(r, "choice") : undefined;
    if (!BOARD_CHOICES.includes(choice as BoardChoice)) continue;
    const target = isObj(r) ? optStr(own(r, "target")) : undefined;
    out[k] = target === undefined ? { choice: choice as BoardChoice } : { choice: choice as BoardChoice, target };
  }
  return out;
}

export function readCards(v: unknown): CardsRead {
  if (!isObj(v)) return {};
  const out: CardsRead = {};
  for (const [k, c] of Object.entries(v)) {
    if (!isObj(c)) continue;
    const card = { purpose: optStr(own(c, "purpose")), choice: optStr(own(c, "choice")), blank: optStr(own(c, "blank")) };
    if (card.purpose !== undefined || card.choice !== undefined) out[k] = card;
  }
  return out;
}
