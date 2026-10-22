// 질의서 응답 마감(SURVEY_CLOSES_AT)과 한국 시각 표시. 순수 모듈 — 서버(페이지·서버 액션)에서 쓴다.
// 서버 시간대는 UTC(Fargate)라 오프셋 없는 값을 그대로 Date.parse 하면 9시간 어긋난다 → 직접 읽어 KST 로 둔다.
// 미설정·해석 불가는 "열림"(오타로 설문이 닫히는 사고 방지) + 프로세스당 경고 한 번. 원래 값은 로그에 남기지 않는다.

export type ClosesAt = { kind: "unset" } | { kind: "invalid" } | { kind: "set"; ms: number };

// 받는 형태는 셋뿐이다(그 밖의 값 — 슬래시, 월 이름 등 — 은 해석 불가):
//   2026-11-06T23:59(:59(.000))?(+09:00|Z)  오프셋·Z 가 있으면 그대로
//   2026-11-06T23:59(:59(.000))?            오프셋이 없으면 KST (T 대신 공백도 됨)
//   2026-11-06                              그날 23:59:59 KST
// Date.parse 는 쓰지 않는다 — 서버 시간대(UTC)에 따라 해석이 달라지기 때문이다.
const ISO_LIKE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?([zZ]|[+-]\d{2}:?\d{2})?)?$/;
const KST_OFFSET_MIN = 9 * 60;

function offsetMinutes(off: string | undefined): number | null {
  if (off === undefined) return KST_OFFSET_MIN;
  if (off === "Z" || off === "z") return 0;
  const hh = Number(off.slice(1, 3));
  const mm = Number(off.slice(-2));
  if (hh > 23 || mm > 59) return null;
  return (off[0] === "-" ? -1 : 1) * (hh * 60 + mm);
}

// 표시·검증 모두 이 하나의 포맷터를 쓴다. hour12:false 는 자정을 "24:00" 으로 내는 엔진이 있어 hourCycle 을 쓴다.
const KST = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

interface KstParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function kstParts(ms: number): KstParts {
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(KST.formatToParts(ms).find((p) => p.type === type)?.value ?? NaN);
  return { y: get("year"), mo: get("month"), d: get("day"), h: get("hour") % 24, mi: get("minute"), s: get("second") };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

export function parseClosesAt(raw: string | undefined): ClosesAt {
  const s = (raw ?? "").trim();
  if (s === "") return { kind: "unset" };
  const m = ISO_LIKE.exec(s);
  if (!m) return { kind: "invalid" };
  const [, y, mo, d, h, mi, sec, frac, off] = m;
  const dateOnly = h === undefined;
  const wall = {
    y: +y,
    mo: +mo,
    d: +d,
    h: dateOnly ? 23 : +h,
    mi: dateOnly ? 59 : +mi,
    s: dateOnly ? 59 : +(sec ?? 0),
  };
  const offMin = offsetMinutes(off);
  if (offMin === null) return { kind: "invalid" };
  const fracMs = frac === undefined ? 0 : Number(frac.padEnd(3, "0"));
  const wallMs = Date.UTC(wall.y, wall.mo - 1, wall.d, wall.h, wall.mi, wall.s, fracMs);
  // 2026-02-30·25:00 처럼 Date.UTC 가 다음 칸으로 넘겨 받아 주는 값은 거절(되돌려 본 값이 입력과 같아야 함)
  const back = new Date(wallMs);
  const same =
    back.getUTCFullYear() === wall.y &&
    back.getUTCMonth() + 1 === wall.mo &&
    back.getUTCDate() === wall.d &&
    back.getUTCHours() === wall.h &&
    back.getUTCMinutes() === wall.mi &&
    back.getUTCSeconds() === wall.s;
  return same ? { kind: "set", ms: wallMs - offMin * 60_000 } : { kind: "invalid" };
}

let warnedUnset = false;
let warnedInvalid = false;

// 요청 시점에 env 를 읽는다(모듈 최상위에서 읽지 않음 — 빌드 시점 영향 없음).
export function readClosesAt(): ClosesAt {
  const c = parseClosesAt(process.env.SURVEY_CLOSES_AT);
  if (c.kind === "unset" && !warnedUnset) {
    warnedUnset = true;
    console.warn("[survey] SURVEY_CLOSES_AT 미설정 — 마감 없이 열어 둡니다");
  }
  if (c.kind === "invalid" && !warnedInvalid) {
    warnedInvalid = true;
    console.warn("[survey] SURVEY_CLOSES_AT 해석 불가 — 마감 없이 열어 둡니다");
  }
  return c;
}

export function isClosedAt(nowMs: number, c: ClosesAt): boolean {
  return c.kind === "set" && nowMs > c.ms;
}

// 페이지 렌더와 서버 액션이 같은 판정을 쓴다. Date.now() 를 여기서 불러 컴포넌트 본문에 두지 않는다.
export function surveyClosedNow():
  | { closed: true; closesAt: { kind: "set"; ms: number } }
  | { closed: false; closesAt: ClosesAt } {
  const closesAt = readClosesAt();
  if (closesAt.kind === "set" && isClosedAt(Date.now(), closesAt)) return { closed: true, closesAt };
  return { closed: false, closesAt };
}

// 2026년 11월 6일 23:59
export function formatKst(ms: number): string {
  const p = kstParts(ms);
  return `${p.y}년 ${p.mo}월 ${p.d}일 ${pad2(p.h)}:${pad2(p.mi)}`;
}

// 2026.11.06 23:59 (해석할 수 없는 값은 그대로 돌려준다)
export function formatKstCompact(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return iso;
  const p = kstParts(ms);
  return `${p.y}.${pad2(p.mo)}.${pad2(p.d)} ${pad2(p.h)}:${pad2(p.mi)}`;
}

// 20261106 (CSV 파일 이름용)
export function kstDateStamp(ms: number): string {
  const p = kstParts(ms);
  return `${p.y}${pad2(p.mo)}${pad2(p.d)}`;
}
