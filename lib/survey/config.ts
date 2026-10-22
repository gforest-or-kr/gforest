// 질의서 응답 마감(SURVEY_CLOSES_AT)과 한국 시각 표시. 순수 모듈 — 서버(페이지·서버 액션)에서 쓴다.
// 서버 시간대는 UTC(Fargate)라 오프셋 없는 값을 그대로 Date.parse 하면 9시간 어긋난다 → KST 로 읽는다.
// 미설정·해석 불가는 "열림"(오타로 설문이 닫히는 사고 방지) + 프로세스당 경고 한 번. 원래 값은 로그에 남기지 않는다.

export type ClosesAt = { kind: "unset" } | { kind: "invalid" } | { kind: "set"; ms: number };

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/;

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
  const m = LOCAL_DATETIME.exec(s);
  if (m) {
    const [, y, mo, d, h, mi, sec = "00"] = m;
    const ms = Date.parse(`${y}-${mo}-${d}T${h}:${mi}:${sec}+09:00`);
    if (Number.isNaN(ms)) return { kind: "invalid" };
    // 2026-02-30 처럼 엔진이 다음 달로 넘겨 받아 주는 값은 거절(되돌려 본 KST 값이 입력과 같아야 함)
    const p = kstParts(ms);
    const same = p.y === +y && p.mo === +mo && p.d === +d && p.h === +h && p.mi === +mi && p.s === +sec;
    return same ? { kind: "set", ms } : { kind: "invalid" };
  }
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? { kind: "invalid" } : { kind: "set", ms };
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
