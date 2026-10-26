import "server-only";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";

// 질의서 '중복 의심' 해시(SVY-04). 막지 않고, 같은 브라우저·같은 IP 의 응답을 관리자 화면에서 묶어 보여 줄 뿐이다.
// 원래 값(IP·쿠키 값)은 저장·로그하지 않고 서버 전용 키로 만든 HMAC 만 DB 에 둔다.
// 소스에 고정 솔트를 두지 않는다 — IPv4 는 경우의 수가 적어 공개된 솔트로는 해시를 누구나 되돌릴 수 있다.

// 쿠키 하나가 두 역할: 존재 = 이 브라우저는 제출한 적 있음(재방문 안내), 값의 HMAC = 브라우저 해시.
export const BID_COOKIE = "svy_bid";
export const BID_COOKIE_MAX_AGE_S = 60 * 60 * 24 * 60; // 60일

const DERIVE_LABEL = "gforest-survey-hash-v1";

function present(v: string | undefined): v is string {
  return typeof v === "string" && v.trim() !== "";
}

// 키 우선순위: SURVEY_HASH_SALT → AUTH_SECRET 에서 용도 분리 파생(AUTH_SECRET 자체는 쓰지 않음) → 없음(null).
export function deriveHashKey(salt: string | undefined, authSecret: string | undefined): Buffer | null {
  if (present(salt)) return Buffer.from(salt, "utf8");
  if (present(authSecret)) return createHmac("sha256", authSecret).update(DERIVE_LABEL).digest();
  return null;
}

let warnedNoKey = false;

// 요청 시점에 env 를 읽는다(모듈 최상위에서 읽지 않음 — 빌드 시점 영향 없음). 키가 없으면 프로세스당 한 번 경고.
export function getHashKey(): Buffer | null {
  const key = deriveHashKey(process.env.SURVEY_HASH_SALT, process.env.AUTH_SECRET);
  if (key === null && !warnedNoKey) {
    warnedNoKey = true;
    console.warn("[survey] SURVEY_HASH_SALT·AUTH_SECRET 미설정 — 중복 의심 해시를 저장하지 않습니다");
  }
  return key;
}

const V4 = String.raw`\d{1,3}(?:\.\d{1,3}){3}`;
const BRACKETED_V6 = /^\[([^\]]+)\](?::\d+)?$/;
const V4_WITH_PORT = new RegExp(`^(${V4}):\\d+$`);
const V4_MAPPED = new RegExp(`^::ffff:(${V4})$`, "i");

// IPv6 는 앞 64비트(/64)만 쓴다 — 개인정보 보호용 임시 주소가 바뀌어도 같은 회선으로 묶이게.
function v6Prefix64(ip: string): string {
  const groups = (s: string) => (s === "" ? [] : s.split(":"));
  const width = (parts: string[]) => parts.reduce((n, p) => n + (p.includes(".") ? 2 : 1), 0);
  let full: string[];
  if (ip.includes("::")) {
    const [head, tail = ""] = ip.split("::");
    const h = groups(head);
    const t = groups(tail);
    full = [...h, ...Array<string>(8 - width(h) - width(t)).fill("0"), ...t];
  } else {
    full = ip.split(":");
  }
  return `${full
    .slice(0, 4)
    .map((x) => parseInt(x, 16).toString(16))
    .join(":")}::/64`;
}

function normalizeIp(raw: string): string | null {
  let s = raw.split("%")[0]; // 영역 id(fe80::1%eth0) 제거
  const bracket = BRACKETED_V6.exec(s);
  if (bracket) s = bracket[1];
  else {
    const withPort = V4_WITH_PORT.exec(s);
    if (withPort) s = withPort[1];
  }
  const mapped = V4_MAPPED.exec(s);
  if (mapped) s = mapped[1];
  const kind = isIP(s);
  if (kind === 4) return s;
  if (kind === 6) return v6Prefix64(s);
  return null;
}

// 클라이언트 IP: x-forwarded-for 의 가장 오른쪽 값만 믿는다. ALB 는 자기가 본 피어를 헤더 끝에 덧붙이고(append),
// 앱 보안 그룹은 ALB 에서 오는 요청만 받는다. 왼쪽 값들은 클라이언트가 마음대로 넣을 수 있으므로 무시한다.
// (Next 서버는 헤더가 없을 때만 소켓 피어로 채운다 — 로컬 next dev 에서는 루프백 주소가 들어온다.)
export function clientIp(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff === null) return null;
  const last = xff.split(",").pop()?.trim() ?? "";
  return last === "" ? null : normalizeIp(last);
}

// kind 를 앞에 붙여 브라우저 id 와 IP 가 같은 문자열이어도 서로 다른 해시가 되게 한다.
export function hmacHex(key: Buffer, kind: "bid" | "ip", value: string): string {
  return createHmac("sha256", key).update(`${kind}:${value}`).digest("hex");
}
