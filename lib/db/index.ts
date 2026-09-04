import "server-only";
import fs from "node:fs";
import path from "node:path";
import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// 값 형태를 Supabase(PostgREST) 시절과 맞춘다: timestamptz/timestamp/date → 문자열(ISO), int8 → number.
// (enum[] 은 OID가 동적이라 파서 등록이 안 됨 — 쿼리에서 ::text[] 로 캐스트할 것)
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => new Date(v).toISOString());
types.setTypeParser(types.builtins.TIMESTAMP, (v) => new Date(v + "Z").toISOString());
types.setTypeParser(types.builtins.DATE, (v) => v);
types.setTypeParser(types.builtins.INT8, (v) => Number(v));

// RDS Postgres 접속 계층. 앱은 RLS가 강제되는 gforest_app 롤로 접속하며(테이블 소유자 아님),
// 모든 쿼리는 트랜잭션 안에서 `app.user_id` 세션 변수를 설정한 뒤 실행한다 — DB의 auth.uid()가
// 이 값을 읽어 기존 RLS 정책(can_read_board 등)이 Supabase 때와 동일하게 동작한다 (CLAUDE.md 원칙 3).
//
//   withUser(userId, (c) => c.query(...))   로그인 사용자 컨텍스트
//   withUser(null,   (c) => c.query(...))   비로그인(anon) 컨텍스트 — 공개 데이터 페처·unstable_cache 안에서 안전

// pg는 connectionString의 sslmode를 파싱해 `ssl` 옵션을 덮어쓴다(→ CA 번들이 무시되어 "self-signed
// certificate in certificate chain"). 그래서 URL에서 sslmode를 떼고 ssl 옵션을 직접 준다.
function splitDatabaseUrl() {
  const raw = process.env.DATABASE_URL ?? "";
  try {
    const u = new URL(raw);
    const sslmode = u.searchParams.get("sslmode");
    u.searchParams.delete("sslmode");
    return { connectionString: u.toString(), sslmode };
  } catch {
    return { connectionString: raw, sslmode: null };
  }
}

function sslConfig(url: string, sslmode: string | null) {
  if (sslmode === "disable" || /localhost|127\.0\.0\.1/.test(url)) return undefined;
  const caPath = process.env.DB_CA_PATH ?? path.join(process.cwd(), "lib/db/rds-global-bundle.pem");
  if (fs.existsSync(caPath)) return { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true };
  // CA 번들이 없으면 암호화만 (개발 편의). 운영 이미지는 Dockerfile이 DB_CA_PATH를 채운다.
  return { rejectUnauthorized: false };
}

// dev(HMR)에서 모듈 재평가로 풀이 늘어나지 않도록 global에 보관
const g = globalThis as unknown as { __gforestPool?: Pool };
export const pool: Pool =
  g.__gforestPool ??
  (g.__gforestPool = new Pool({
    connectionString: splitDatabaseUrl().connectionString,
    ssl: sslConfig(splitDatabaseUrl().connectionString, splitDatabaseUrl().sslmode),
    max: Number(process.env.DB_POOL_MAX ?? 5), // 태스크 2개 × 5 = RDS micro(max_connections≈80)에 여유
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  }));

export type DbClient = PoolClient;

// 사용자 컨텍스트 트랜잭션. fn이 throw하면 롤백. userId=null이면 anon.
export async function withUser<T>(
  userId: string | null,
  fn: (c: DbClient) => Promise<T>,
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("begin");
    await c.query("select set_config('app.user_id', $1, true)", [userId ?? ""]);
    const result = await fn(c);
    await c.query("commit");
    return result;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}

// 단건 조회 헬퍼
export async function one<T extends QueryResultRow>(
  c: DbClient,
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const r = await c.query<T>(text, params);
  return r.rows[0] ?? null;
}

export async function many<T extends QueryResultRow>(
  c: DbClient,
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const r = await c.query<T>(text, params);
  return r.rows;
}

// Postgres 에러 코드 판별 (23505 unique_violation, 42501 insufficient_privilege = RLS 거부, 23514 check)
export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}
