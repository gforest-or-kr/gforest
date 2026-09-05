// XE 첨부 본체 복사: attachments(legacy_file_srl) ↔ xe_files.uploaded_filename → HTTP GET → S3/MinIO PUT.
//   npm run xe:files -- [--since 2024] [--limit N] [--concurrency 4]
// 원 사이트가 files/attach/... 를 로그인 없이 내주므로 FTP 없이 복사한다. 이미 있는 키(HEAD 200, 같은 크기)는 건너뛴다.
import mysql from "mysql2/promise";
import pg from "pg";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : d; };
const SINCE = opt("--since", "");
const LIMIT = Number(opt("--limit", "0")) || 0;
const CONC = Number(opt("--concurrency", "4")) || 4;

const XE_URL = process.env.XE_MYSQL_URL ?? "mysql://root:xe@127.0.0.1:3307/purunsup7";
const PG_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://gforest_admin:gforest@localhost:5432/gforest";
const XE_BASE = process.env.XE_BASE_URL ?? "https://www.gforest.or.kr/xe/";
const BUCKET = process.env.MEDIA_BUCKET;
if (!BUCKET) { console.error("MEDIA_BUCKET 필요 (.env.local)"); process.exit(2); }
const endpoint = process.env.S3_ENDPOINT;
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-2", ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });

const xe = await mysql.createConnection({ uri: XE_URL, charset: "utf8mb4" });
const pgc = new pg.Client({ connectionString: PG_URL.replace(/[?&]sslmode=require/, ""), ssl: /rds\.amazonaws\.com/.test(PG_URL) ? { rejectUnauthorized: false } : undefined });
await pgc.connect();

const targets = (await pgc.query("select id, storage_path, byte_size, mime_type, legacy_file_srl from attachments where legacy_file_srl is not null order by legacy_file_srl desc")).rows;
const srcs = new Map((await xe.query(`select file_srl, uploaded_filename, regdate from xe_files where isvalid='Y'${SINCE ? ` and regdate >= '${SINCE.padEnd(14, "0")}'` : ""}`))[0]
  .map((r) => [Number(r.file_srl), String(r.uploaded_filename)]));
await xe.end(); await pgc.end();

let list = targets.filter((t) => srcs.has(Number(t.legacy_file_srl)));
if (LIMIT) list = list.slice(0, LIMIT);
console.log(`복사 대상 ${list.length}개 (attachments ${targets.length}, 원본 필터 ${srcs.size})`);

let done = 0, skipped = 0, failed = 0, bytes = 0;
const t0 = Date.now();
async function one(t) {
  const key = `attachments/${t.storage_path}`;
  try {
    const h = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key })).catch((e) => (e.$metadata?.httpStatusCode === 404 ? null : Promise.reject(e)));
    if (h && Number(h.ContentLength) === Number(t.byte_size)) { skipped++; return; }
    const rel = srcs.get(Number(t.legacy_file_srl)).replace(/^\.\//, "");
    const url = XE_BASE + rel.split("/").map(encodeURIComponent).join("/");
    let res;
    for (let a = 0; a < 3; a++) {
      res = await fetch(url, { headers: { "User-Agent": "gforest-migration/1.0" } });
      if (res.ok) break;
      await new Promise((r) => setTimeout(r, 1000 * (a + 1)));
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
    const body = Buffer.from(await res.arrayBuffer());
    await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: t.mime_type }));
    done++; bytes += body.length;
  } catch (e) {
    failed++; console.error(`FAIL ${t.legacy_file_srl}: ${e.message}`);
  }
  const n = done + skipped + failed;
  if (n % 200 === 0) console.log(`${n}/${list.length} ok=${done} skip=${skipped} fail=${failed} ${(bytes / 1048576).toFixed(0)}MB ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
let idx = 0;
await Promise.all(Array.from({ length: CONC }, async () => { while (idx < list.length) await one(list[idx++]); }));
console.log(`끝: ok=${done} skip=${skipped} fail=${failed} ${(bytes / 1048576).toFixed(0)}MB ${((Date.now() - t0) / 1000).toFixed(0)}s`);
process.exit(failed ? 1 : 0);
