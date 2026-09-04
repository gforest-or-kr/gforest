// 미적용 마이그레이션(db/migrations/*.sql) 적용 — 배포 파이프라인(ecs-deploy.yml)이 VPC 안 일회성 태스크로,
// 로컬은 db/bootstrap.sh 가 호출한다. 의존성은 pg 뿐(런타임 이미지에 포함).
//   DATABASE_ADMIN_URL=postgresql://gforest_admin:...@host:5432/gforest?sslmode=require node db/migrate.mjs
// 규칙(db/README.md): 파일명(확장자 제외)이 version, 한 파일 = 한 트랜잭션, 적용된 파일은 수정하지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = process.env.DATABASE_ADMIN_URL;
if (!raw) {
  console.error("DATABASE_ADMIN_URL 이 필요합니다");
  process.exit(2);
}

// lib/db/index.ts 와 같은 이유로 sslmode 를 URL 에서 떼고 ssl 옵션을 직접 준다 (CA 번들 무시 방지)
const url = new URL(raw);
const sslmode = url.searchParams.get("sslmode");
url.searchParams.delete("sslmode");
const isLocal = ["localhost", "127.0.0.1", "db"].includes(url.hostname);
let ssl;
if (!(sslmode === "disable" || isLocal)) {
  const caPath = process.env.DB_CA_PATH ?? path.join(here, "../lib/db/rds-global-bundle.pem");
  ssl = fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath, "utf8"), rejectUnauthorized: true } : { rejectUnauthorized: false };
}

const client = new pg.Client({ connectionString: url.toString(), ssl, application_name: "gforest-migrate" });
await client.connect();
try {
  await client.query(
    "create table if not exists public.schema_migrations (version text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set((await client.query("select version from public.schema_migrations")).rows.map((r) => r.version));
  const files = fs.readdirSync(path.join(here, "migrations")).filter((f) => f.endsWith(".sql")).sort();
  let n = 0;
  for (const f of files) {
    const version = f.replace(/\.sql$/, "");
    if (applied.has(version)) {
      console.log(`  skip  ${version}`);
      continue;
    }
    console.log(`  apply ${version}`);
    await client.query("begin");
    try {
      await client.query(fs.readFileSync(path.join(here, "migrations", f), "utf8"));
      await client.query("insert into public.schema_migrations(version) values ($1)", [version]);
      await client.query("commit");
      n++;
    } catch (e) {
      await client.query("rollback").catch(() => {});
      console.error(`  FAILED ${version}: ${e.message}`);
      process.exit(1);
    }
  }
  // 기본 권한(default privileges)이 대부분을 덮지만, 다른 롤이 만든 객체 등 예외를 위해 한 번 더
  await client.query(`
    grant select, insert, update, delete on all tables in schema public to gforest_app;
    grant usage, select on all sequences in schema public to gforest_app;
    grant execute on all functions in schema public to gforest_app;
  `);
  console.log(`migrations: ${n} applied, ${files.length - n} already applied`);
} finally {
  await client.end();
}
