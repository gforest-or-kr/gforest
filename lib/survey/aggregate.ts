// 질의서 관리자 집계 — 순수 모듈(DB·React 없음). 데이터는 인자로 받고, 입력을 바꾸지 않는다.
// 중복 의심 묶음(union-find), 집계 대상 고르기, 응답 현황, 문항별 집계를 계산한다.
// 문항별 집계는 item 종류로만 갈린다(문항 id 분기 없음) — 문항을 고치면 집계도 따라온다.
import {
  itemValue,
  readBoards,
  readCards,
  readMulti,
  readSingle,
  readText,
  type BoardsRead,
  type CardsRead,
} from "./read-values";
import type {
  AdminAnswerRow,
  AdminResponseRow,
  BoardAccess,
  BoardChoice,
  CardDef,
  Choice,
  Item,
  Question,
  RespondentRole,
} from "./types";

export type DupReason = "browser" | "ip" | "both";

export interface DupInfo {
  group: number;
  reason: DupReason;
}

export type DupMap = ReadonlyMap<string, DupInfo>;

export type DupMode = "include" | "exclude";

export const DUP_REASON_LABEL: Readonly<Record<DupReason, string>> = {
  browser: "같은 브라우저",
  ip: "같은 IP",
  both: "같은 브라우저·같은 IP",
};

export interface RoleCount {
  key: string;
  label: string;
  count: number;
}

// 같은 값(NULL 제외)이 두 번 이상 나온 해시 집합
function sharedValues(values: readonly (string | null)[]): Set<string> {
  const seen = new Set<string>();
  const shared = new Set<string>();
  for (const v of values) {
    if (v === null) continue;
    if (seen.has(v)) shared.add(v);
    else seen.add(v);
  }
  return shared;
}

// 응답 id → 대표 id. 같은 browser_hash 또는 같은 ip_hash 를 공유하면 같은 묶음(이행적).
function unionFind(rows: readonly AdminResponseRow[]): (id: string) => string {
  const parent = new Map<string, string>(rows.map((r) => [r.id, r.id]));
  const find = (id: string): string => {
    let p = id;
    while (parent.get(p) !== p) p = parent.get(p) ?? p;
    return p;
  };
  const firstByKey = new Map<string, string>();
  for (const r of rows) {
    for (const key of [r.browserHash && `b:${r.browserHash}`, r.ipHash && `i:${r.ipHash}`]) {
      if (!key) continue;
      const other = firstByKey.get(key);
      if (other === undefined) firstByKey.set(key, r.id);
      else parent.set(find(r.id), find(other));
    }
  }
  return find;
}

// 크기 ≥ 2 인 묶음만 번호(1..)를 받는다. 번호 순서 = 묶음 안 가장 작은 응답 번호 순.
export function dupGroups(rows: readonly AdminResponseRow[]): Map<string, DupInfo> {
  const find = unionFind(rows);
  const members = new Map<string, AdminResponseRow[]>();
  for (const r of rows) {
    const root = find(r.id);
    members.set(root, [...(members.get(root) ?? []), r]);
  }
  const groups = [...members.values()]
    .filter((g) => g.length >= 2)
    .map((g) => ({ g, min: Math.min(...g.map((r) => r.no)) }))
    .sort((a, b) => a.min - b.min);
  const sharedBrowser = sharedValues(rows.map((r) => r.browserHash));
  const sharedIp = sharedValues(rows.map((r) => r.ipHash));
  const out = new Map<string, DupInfo>();
  groups.forEach(({ g }, i) => {
    for (const r of g) {
      const b = r.browserHash !== null && sharedBrowser.has(r.browserHash);
      const ip = r.ipHash !== null && sharedIp.has(r.ipHash);
      out.set(r.id, { group: i + 1, reason: b && ip ? "both" : b ? "browser" : "ip" });
    }
  });
  return out;
}

// "제외" = 묶음마다 가장 이른 응답(가장 작은 응답 번호) 하나만 남긴다(PD-04). "포함" = 전부.
export function countedResponses(
  rows: readonly AdminResponseRow[],
  dup: DupMap,
  mode: DupMode,
): AdminResponseRow[] {
  if (mode === "include") return [...rows];
  const firstNo = new Map<number, number>();
  for (const r of rows) {
    const d = dup.get(r.id);
    if (d) firstNo.set(d.group, Math.min(firstNo.get(d.group) ?? Infinity, r.no));
  }
  return rows.filter((r) => {
    const d = dup.get(r.id);
    return d === undefined || firstNo.get(d.group) === r.no;
  });
}

// 응답자 구분별 건수 — 한 응답이 여러 구분을 고르면 구분마다 한 번씩 센다. 순서 = roles 정의 순서.
export function roleCounts(rows: readonly AdminResponseRow[], roles: readonly RespondentRole[]): RoleCount[] {
  return roles.map((role) => ({
    key: role.key,
    label: role.label,
    count: rows.filter((r) => r.roles.includes(role.key)).length,
  }));
}

export interface Overview {
  total: number;
  dupCount: number;
  countedCount: number;
  lastSubmittedAt: string | null;
  roleCounts: RoleCount[];
}

// 구분별 건수는 집계 대상(counted) 기준 — "포함"이면 전체 응답과 같다.
export function overview(
  rows: readonly AdminResponseRow[],
  counted: readonly AdminResponseRow[],
  roles: readonly RespondentRole[],
  dup: DupMap,
): Overview {
  const last = rows.reduce<string | null>(
    (acc, r) => (acc === null || Date.parse(r.submittedAt) > Date.parse(acc) ? r.submittedAt : acc),
    null,
  );
  return {
    total: rows.length,
    dupCount: rows.filter((r) => dup.has(r.id)).length,
    countedCount: counted.length,
    lastSubmittedAt: last,
    roleCounts: roleCounts(counted, roles),
  };
}

// 응답의 구분 라벨들(정의 순서, ", " 로 잇기) — 화면 메타·CSV 공용
export function roleLabels(keys: readonly string[], roles: readonly RespondentRole[]): string {
  return roles
    .filter((r) => keys.includes(r.key))
    .map((r) => r.label)
    .join(", ");
}

// ---- 문항별 집계 ----

export const SKIP_LABEL = "미정 / 모름";

export interface FreeText {
  no: number;
  roleLabels: string;
  text: string;
}

export interface OptionAggregate {
  key: string;
  label: string;
  count: number;
  byRole: RoleCount[];
  blanks: FreeText[];
  hasBlank: boolean;
}

export interface BoardAggregate {
  key: string;
  name: string;
  access: BoardAccess;
  answered: number; // 0 = 표시 없음
  counts: Record<BoardChoice, number>;
  byRole: Record<BoardChoice, RoleCount[]>;
  targets: FreeText[];
}

export interface CardAggregate {
  key: string;
  name: string;
  meta: string;
  purposeLabel: string;
  answered: number;
  purposes: FreeText[];
  options: OptionAggregate[];
}

interface ItemBase {
  key: string;
  title: string | null;
  answered: number; // 이 항목에 값이 있는 집계 대상 응답 수
  total: number; // 집계 대상 응답 수
}

export type ItemAggregate =
  | (ItemBase & { kind: "single" | "multi"; options: OptionAggregate[] })
  | (ItemBase & { kind: "text"; texts: FreeText[] })
  | (ItemBase & { kind: "boards"; rows: BoardAggregate[] })
  | (ItemBase & { kind: "cards"; cards: CardAggregate[] });

export interface QuestionAggregate {
  id: string;
  no: number | null;
  section: number;
  title: string;
  items: ItemAggregate[];
}

interface Resp {
  no: number;
  roles: readonly string[];
  roleLabels: string;
  answers: ReadonlyMap<string, unknown>;
}

interface Pick {
  r: Resp;
  key: string;
  blank?: string;
}

const free = (r: Resp, text: string): FreeText => ({ no: r.no, roleLabels: r.roleLabels, text });

function byRole(rs: readonly Resp[], roles: readonly RespondentRole[]): RoleCount[] {
  return roles.map((role) => ({
    key: role.key,
    label: role.label,
    count: rs.filter((r) => r.roles.includes(role.key)).length,
  }));
}

function optionAggregates(options: readonly Choice[], picks: readonly Pick[], roles: readonly RespondentRole[]) {
  return options.map((o): OptionAggregate => {
    const hit = picks.filter((p) => p.key === o.key);
    return {
      key: o.key,
      label: o.label,
      count: hit.length,
      byRole: byRole(
        hit.map((p) => p.r),
        roles,
      ),
      blanks: hit.flatMap((p) => (p.blank === undefined ? [] : [free(p.r, p.blank)])),
      hasBlank: o.blank !== undefined,
    };
  });
}

// 접미 콜론 없는 라벨(예: "기타 의견:" → "기타 의견") — 화면 소제목·CSV 머리글 공용
export function plainLabel(label: string): string {
  return label.replace(/\s*:\s*$/, "");
}

function boardAggregates(item: Extract<Item, { type: "boards" }>, values: readonly [Resp, BoardsRead][], roles: readonly RespondentRole[]) {
  return item.rows.map((row): BoardAggregate => {
    const picks = values.flatMap(([r, v]) => (v[row.key] ? [{ r, ...v[row.key] }] : []));
    const of = (c: BoardChoice) => picks.filter((p) => p.choice === c);
    return {
      key: row.key,
      name: row.name,
      access: row.access,
      answered: picks.length,
      counts: { keep: of("keep").length, merge: of("merge").length, drop: of("drop").length },
      byRole: {
        keep: byRole(of("keep").map((p) => p.r), roles),
        merge: byRole(of("merge").map((p) => p.r), roles),
        drop: byRole(of("drop").map((p) => p.r), roles),
      },
      targets: of("merge").flatMap((p) => (p.target === undefined ? [] : [free(p.r, p.target)])),
    };
  });
}

function cardAggregate(card: CardDef, values: readonly [Resp, CardsRead][], roles: readonly RespondentRole[]): CardAggregate {
  const mine = values.flatMap(([r, v]) => (v[card.key] ? [{ r, c: v[card.key] }] : []));
  const picks = mine.flatMap(({ r, c }) => (c.choice === undefined ? [] : [{ r, key: c.choice, blank: c.blank }]));
  return {
    key: card.key,
    name: card.name,
    meta: card.meta,
    purposeLabel: card.purposeLabel,
    answered: mine.length,
    purposes: mine.flatMap(({ r, c }) => (c.purpose === undefined ? [] : [free(r, c.purpose)])),
    options: optionAggregates(card.options, picks, roles),
  };
}

function aggregateItem(qid: string, item: Item, rs: readonly Resp[], roles: readonly RespondentRole[]): ItemAggregate | null {
  const raw = (r: Resp) => itemValue(r.answers.get(qid), "key" in item ? item.key : "");
  const total = rs.length;
  switch (item.type) {
    case "single": {
      const picks = rs.flatMap((r) => {
        const v = readSingle(raw(r));
        return v ? [{ r, key: v.choice, blank: v.blank }] : [];
      });
      const options = optionAggregates(item.options, picks, roles);
      return { kind: "single", key: item.key, title: item.title ?? null, answered: picks.length, total, options };
    }
    case "multi": {
      const values = rs.flatMap((r) => {
        const v = readMulti(raw(r));
        return v ? [{ r, v }] : [];
      });
      const picks = values.flatMap(({ r, v }) => v.choices.map((key) => ({ r, key, blank: v.blanks[key] })));
      const options = optionAggregates(item.options, picks, roles);
      return { kind: "multi", key: item.key, title: item.title ?? null, answered: values.length, total, options };
    }
    case "text":
    case "textarea": {
      const texts = rs.flatMap((r) => {
        const v = readText(raw(r));
        if (v === null || ("skip" in v && item.type === "textarea")) return [];
        return [free(r, "skip" in v ? SKIP_LABEL : v.text)];
      });
      return { kind: "text", key: item.key, title: plainLabel(item.label), answered: texts.length, total, texts };
    }
    case "boards": {
      const values = rs.map((r): [Resp, BoardsRead] => [r, readBoards(raw(r))]);
      const answered = values.filter(([, v]) => Object.keys(v).length > 0).length;
      return { kind: "boards", key: item.key, title: null, answered, total, rows: boardAggregates(item, values, roles) };
    }
    case "cards": {
      const values = rs.map((r): [Resp, CardsRead] => [r, readCards(raw(r))]);
      const answered = values.filter(([, v]) => Object.keys(v).length > 0).length;
      const cards = item.cards.map((c) => cardAggregate(c, values, roles));
      return { kind: "cards", key: item.key, title: null, answered, total, cards };
    }
    case "leader-list":
    case "note":
      return null; // 읽기 전용 — 값이 없다
  }
}

function toResps(
  counted: readonly AdminResponseRow[],
  answers: readonly AdminAnswerRow[],
  roles: readonly RespondentRole[],
): Resp[] {
  const ids = new Set(counted.map((r) => r.id));
  const byResponse = new Map<string, Map<string, unknown>>();
  for (const a of answers) {
    if (!ids.has(a.responseId)) continue;
    const m = byResponse.get(a.responseId) ?? new Map<string, unknown>();
    m.set(a.questionId, a.value);
    byResponse.set(a.responseId, m);
  }
  return [...counted]
    .sort((a, b) => a.no - b.no)
    .map((r) => ({ no: r.no, roles: r.roles, roleLabels: roleLabels(r.roles, roles), answers: byResponse.get(r.id) ?? new Map() }));
}

export function aggregateQuestions(
  questions: readonly Question[],
  roles: readonly RespondentRole[],
  counted: readonly AdminResponseRow[],
  answers: readonly AdminAnswerRow[],
): QuestionAggregate[] {
  const rs = toResps(counted, answers, roles);
  return questions.map((q) => ({
    id: q.id,
    no: q.no,
    section: q.section,
    title: q.title,
    items: q.items.flatMap((item) => {
      const a = aggregateItem(q.id, item, rs, roles);
      return a ? [a] : [];
    }),
  }));
}

// 0절 기타 직접 입력(응답 메타)
export function roleOtherTexts(counted: readonly AdminResponseRow[], roles: readonly RespondentRole[]): FreeText[] {
  return [...counted]
    .sort((a, b) => a.no - b.no)
    .flatMap((r) => (r.roleOther ? [{ no: r.no, roleLabels: roleLabels(r.roles, roles), text: r.roleOther }] : []));
}
