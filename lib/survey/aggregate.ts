// 질의서 관리자 집계 — 순수 모듈(DB·React 없음). 데이터는 인자로 받고, 입력을 바꾸지 않는다.
// 중복 의심 묶음(union-find), 집계 대상 고르기, 응답 현황을 계산한다.
import type { AdminResponseRow, RespondentRole } from "./types";

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
