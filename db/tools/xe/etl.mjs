// XE1 → 신규 스키마 ETL. 사용법·규칙은 db/tools/xe/README.md, 매핑은 mapping.json.
//   npm run xe:etl -- [--anonymize] [--only members,pages,posts,comments,files] [--limit N]
// 멱등: legacy_* unique 키로 upsert. 대상에는 관리자(테이블 소유자) 롤로 접속해야 한다(RLS 우회).
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import pg from "pg";
import sanitizeHtml from "sanitize-html";

const here = path.dirname(fileURLToPath(import.meta.url));
const MAP = JSON.parse(fs.readFileSync(path.join(here, "mapping.json"), "utf8"));

// ---------- CLI ----------
const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const ANON = flag("--anonymize");
const ONLY = (opt("--only") ?? "members,pages,posts,comments,files").split(",");
const LIMIT = Number(opt("--limit") ?? 0) || 0;

const XE_URL = process.env.XE_MYSQL_URL ?? "mysql://root:xe@127.0.0.1:3307/purunsup7";
const PG_URL = process.env.DATABASE_ADMIN_URL ?? "postgresql://gforest_admin:gforest@localhost:5432/gforest";
const XE_BASE = process.env.XE_BASE_URL ?? "https://www.gforest.or.kr/xe/";

// ---------- helpers ----------
// srl → 고정 UUID (같은 원본 행은 항상 같은 id → 참조를 미리 알 수 있고 재실행이 안전)
function legacyUuid(kind, srl) {
  const h = createHash("md5").update(`gforest-xe:${kind}:${srl}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
// XE 'YYYYMMDDHHMMSS' (서버 로컬 = KST) → ISO
function xeDate(s) {
  if (!s || s.length < 8) return null;
  const p = String(s).padEnd(14, "0");
  return `${p.slice(0, 4)}-${p.slice(4, 6)}-${p.slice(6, 8)}T${p.slice(8, 10)}:${p.slice(10, 12)}:${p.slice(12, 14)}+09:00`;
}
const ymd = (s) => (s && /^\d{8}$/.test(s) ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : null);
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const decode = (s) => String(s).replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&");
function htmlToText(html) {
  return decode(
    String(html)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|tr|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  ).replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}
const MIME = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
  pdf: "application/pdf", hwp: "application/x-hwp", hwpx: "application/x-hwp", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", zip: "application/zip",
  txt: "text/plain", mp3: "audio/mpeg", mp4: "video/mp4", m4a: "audio/mp4", mov: "video/quicktime" };
function extOf(name) {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name ?? "");
  return m ? m[1].toLowerCase() : "bin";
}
const ROLE_RANK = { admin: 5, operator: 4, teacher: 3, student: 2, member: 1, pending: 0 };

// 레거시 본문 sanitize — WYSIWYG 용(lib/sanitize.ts)보다 넓게: 표·이미지·정렬·style 허용, script/iframe/on* 제거
const LEGACY_SANITIZE = {
  allowedTags: ["p", "br", "div", "span", "strong", "b", "em", "i", "u", "s", "del", "strike", "sup", "sub", "font", "small", "big",
    "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "pre", "code", "hr", "a", "img",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption", "colgroup", "col", "dl", "dt", "dd", "center"],
  allowedAttributes: {
    "*": ["style", "align", "valign", "width", "height", "border", "cellpadding", "cellspacing", "colspan", "rowspan", "bgcolor", "color", "size", "face", "title"],
    a: ["href", "name", "target"],
    img: ["src", "alt", "width", "height"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"], a: ["http", "https", "mailto"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  transformTags: {
    a: (t, a) => ({ tagName: "a", attribs: { ...a, rel: "noopener noreferrer nofollow", target: "_blank" } }),
  },
};
// XE 본문 안의 첨부 경로(절대/상대 모두) → /dl/<id>?inline=1. 매칭 안 되면 원 사이트 절대 URL로(추후 깨짐 감수)
function rewriteAttachUrls(html, pathToAttId) {
  return html.replace(/(?:https?:\/\/[^"'\s)]*?\/xe\/)?(?:\.\/|\/xe\/|\/)?files\/attach\/(images|binaries)\/([^"'\s)<>]+)/g, (m, kind, rest) => {
    const key = `./files/attach/${kind}/${decodeURIComponent(rest)}`;
    const id = pathToAttId.get(key) ?? pathToAttId.get(`./files/attach/${kind}/${rest}`);
    return id ? `/dl/${id}?inline=1` : `${XE_BASE}files/attach/${kind}/${rest}`;
  });
}
function legacyHtml(raw, pathToAttId) {
  let html = String(raw ?? "");
  if (!/<[a-z][\s\S]*>/i.test(html)) {
    // 태그 없는 옛 글: 줄바꿈 보존
    html = html.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  }
  html = rewriteAttachUrls(html, pathToAttId);
  return sanitizeHtml(html, LEGACY_SANITIZE);
}
function extraVarsTable(vars) {
  const rows = vars.filter((v) => !v.eid.startsWith("ext_plan_") && v.value != null && String(v.value).trim() !== "");
  if (rows.length === 0) return "";
  const tr = rows.map((v) => {
    const label = MAP.extraVarLabels[v.eid] ?? v.eid;
    let val = String(v.value).replace(/\|@\|/g, ", ");
    if (ANON && MAP.sensitiveExtraVars.includes(v.eid)) val = "(가명화)";
    return `<tr><th style="text-align:left;padding:4px 8px;background:#f5f5f5">${esc(label)}</th><td style="padding:4px 8px">${esc(val)}</td></tr>`;
  }).join("");
  return `<hr><table class="legacy-extra" style="border-collapse:collapse;font-size:0.9em"><tbody>${tr}</tbody></table>`;
}

// ---------- pg bulk upsert via unnest ----------
async function bulk(pgc, table, cols, rows, conflictKey, updateCols, types) {
  if (rows.length === 0) return 0;
  const params = cols.map((_, i) => rows.map((r) => r[i]));
  const unnest = cols.map((c, i) => `$${i + 1}::${types[i]}[]`).join(", ");
  const sets = updateCols.map((c) => `${c} = excluded.${c}`).join(", ");
  const sql = `insert into ${table} (${cols.join(", ")}) select * from unnest(${unnest})
    on conflict (${conflictKey}) do update set ${sets}`;
  const r = await pgc.query(sql, params);
  return r.rowCount;
}

// ---------- main ----------
const xe = await mysql.createConnection({ uri: XE_URL, charset: "utf8mb4", supportBigNumbers: true, bigNumberStrings: false });
const pgc = new pg.Client({ connectionString: PG_URL.replace(/[?&]sslmode=require/, ""), ssl: /rds\.amazonaws\.com/.test(PG_URL) ? { rejectUnauthorized: false } : undefined });
await pgc.connect();
const q = async (sql, p = []) => (await xe.query(sql, p))[0];
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const stats = {};

try {
  await pgc.query("alter table public.profiles disable trigger trg_profiles_guard_role");

  // 시스템 프로필 2개
  async function ensureSystemUser(email, nickname, name, role) {
    let r = await pgc.query("select id from auth.users where lower(email)=lower($1)", [email]);
    let id = r.rows[0]?.id;
    if (!id) {
      r = await pgc.query("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
        [email, JSON.stringify({ nickname, name })]);
      id = r.rows[0].id;
    }
    await pgc.query("update profiles set role=$2, nickname=$3, name=$4 where id=$1", [id, role, nickname, name]);
    return id;
  }
  const SYSTEM_ID = await ensureSystemUser("system@gforest.or.kr", "시스템", "시스템", "admin");
  const UNKNOWN_ID = await ensureSystemUser("legacy-unknown@gforest.or.kr", "탈퇴·익명회원", "탈퇴·익명회원", "pending");
  await pgc.query("select set_config('app.user_id', $1, false)", [SYSTEM_ID]);

  // ===== 1. members =====
  const memberToProfile = new Map(); // member_srl → profile id
  {
    const existing = await pgc.query("select id, legacy_member_srl from profiles where legacy_member_srl is not null");
    for (const r of existing.rows) memberToProfile.set(Number(r.legacy_member_srl), r.id);
  }
  if (ONLY.includes("members")) {
    const members = await q("select member_srl, user_id, email_address, user_name, nick_name, denied, is_admin, regdate, last_login from xe_member order by member_srl");
    const groups = await q("select gm.member_srl, g.title from xe_member_group_member gm join xe_member_group g on g.group_srl=gm.group_srl");
    const groupsOf = new Map();
    for (const g of groups) (groupsOf.get(g.member_srl) ?? groupsOf.set(g.member_srl, []).get(g.member_srl)).push(g.title);
    const taken = new Set((await pgc.query("select nickname from profiles")).rows.map((r) => r.nickname.toLowerCase()));
    const nickOfSrl = new Map((await pgc.query("select legacy_member_srl, nickname from profiles where legacy_member_srl is not null")).rows.map((r) => [Number(r.legacy_member_srl), r.nickname]));
    const cutoff = Date.now() - MAP.inactiveToPendingAfterDays * 86400e3;
    let n = 0;
    for (const m of members) {
      const srl = Number(m.member_srl);
      let role = "member";
      for (const g of groupsOf.get(srl) ?? []) {
        const r = MAP.roleByGroup[g];
        if (r && ROLE_RANK[r] > ROLE_RANK[role]) role = r;
      }
      if (m.is_admin === "Y") role = "admin";
      if (m.denied === "Y") role = "pending";
      const lastLogin = xeDate(m.last_login) ? Date.parse(xeDate(m.last_login)) : 0;
      if (role === "member" && lastLogin < cutoff) role = "pending";

      let email = String(m.email_address ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) email = `legacy-${srl}@invalid.gforest.or.kr`;
      let name = String(m.user_name ?? "").trim();
      let nick = String(m.nick_name ?? "").trim() || `회원${srl}`;
      if (ANON) { email = `member${srl}@example.invalid`; name = `회원${srl}`; nick = `회원${srl}`; }
      nick = [...nick].slice(0, 20).join("");
      if (nick.length < 2) nick = `회원${srl}`;
      // 닉네임 unique: 이미 이 회원이 쓰는 닉이면 유지, 남이 쓰면 접미사
      const mine = nickOfSrl.get(srl);
      if (mine && mine.toLowerCase() !== nick.toLowerCase()) taken.delete(mine.toLowerCase());
      if (!(mine && mine.toLowerCase() === nick.toLowerCase())) {
        let cand = nick, k = 2;
        while (taken.has(cand.toLowerCase())) { const suf = `_${k++}`; cand = [...nick].slice(0, 20 - suf.length).join("") + suf; }
        nick = cand; taken.add(nick.toLowerCase());
      }

      let pid = memberToProfile.get(srl);
      if (!pid) {
        const dup = await pgc.query("select id from auth.users where lower(email)=$1", [email]);
        if (dup.rows[0]) {
          pid = dup.rows[0].id; // 같은 이메일이 이미 있으면(테스트 계정 등) 그 프로필에 연결
        } else {
          pid = legacyUuid("member", srl);
          await pgc.query(
            `insert into auth.users (id, email, encrypted_password, created_at, last_sign_in_at, raw_user_meta_data)
             values ($1, $2, null, $3, $4, $5) on conflict (id) do nothing`,
            [pid, email, xeDate(m.regdate) ?? new Date().toISOString(), xeDate(m.last_login), JSON.stringify({ nickname: nick, name })],
          );
        }
        memberToProfile.set(srl, pid);
      } else {
        await pgc.query("update auth.users set email=$2, last_sign_in_at=$3 where id=$1", [pid, email, xeDate(m.last_login)]);
      }
      await pgc.query(
        `update profiles set nickname=$2, name=$3, role=$4, legacy_member_srl=$5, created_at=coalesce($6, created_at) where id=$1`,
        [pid, nick, name, role, srl, xeDate(m.regdate)],
      );
      if (++n % 500 === 0) log(`members ${n}/${members.length}`);
    }
    stats.members = { source: members.length, target: memberToProfile.size };
    log(`members done: ${members.length}`);
  }
  const profileOf = (srl) => (srl && memberToProfile.get(Number(srl))) || UNKNOWN_ID;

  // ===== 2. boards / modules =====
  const modules = await q("select module_srl, mid, module, browser_title from xe_modules");
  const boardBySlug = new Map((await pgc.query("select id, slug, legacy_mid from boards")).rows.map((r) => [r.slug, r]));
  const boardByMid = new Map([...boardBySlug.values()].filter((b) => b.legacy_mid).map((b) => [b.legacy_mid, b.id]));
  let archiveId = boardBySlug.get(MAP.archiveBoard.slug)?.id;
  if (!archiveId) {
    const a = MAP.archiveBoard;
    archiveId = (await pgc.query(
      `insert into boards (slug, name, menu_group, sort_order, read_roles, write_roles, is_active) values ($1,$2,$3,$4,$5,$6,true) returning id`,
      [a.slug, a.name, a.menu_group, a.sort_order, a.read_roles, a.write_roles],
    )).rows[0].id;
    log(`archive board created: ${a.slug}`);
  }
  const boardOfModule = new Map(); // module_srl → board id
  const midOfModule = new Map();
  const archived = [];
  for (const m of modules) {
    midOfModule.set(Number(m.module_srl), m.mid);
    if (m.module !== "board") continue;
    const id = boardByMid.get(m.mid);
    if (id) boardOfModule.set(Number(m.module_srl), id);
    else { boardOfModule.set(Number(m.module_srl), archiveId); archived.push(m.mid); }
  }
  log(`boards: ${boardByMid.size} mapped, archived mids: ${archived.join(",")}`);

  // ===== 첨부 사전 계산 (본문 URL 치환에 필요) =====
  const files = await q("select file_srl, upload_target_srl, member_srl, source_filename, uploaded_filename, file_size, regdate from xe_files where isvalid='Y'");
  const docSrls = new Set((await q("select document_srl from xe_documents where status='PUBLIC'")).map((r) => Number(r.document_srl)));
  const commentDoc = new Map((await q("select comment_srl, document_srl from xe_comments where status=1 and is_secret='N'")).map((r) => [Number(r.comment_srl), Number(r.document_srl)]));
  const pathToAttId = new Map();
  const attRows = []; // [id, post_id, uploader_id, storage_path, file_name, byte_size, mime_type, legacy_file_srl, created_at]
  for (const f of files) {
    const target = Number(f.upload_target_srl);
    const docSrl = docSrls.has(target) ? target : commentDoc.get(target);
    if (!docSrl || !docSrls.has(docSrl)) continue;
    const id = legacyUuid("file", f.file_srl);
    pathToAttId.set(String(f.uploaded_filename), id);
    const ext = extOf(f.source_filename);
    const uploader = profileOf(f.member_srl);
    attRows.push([id, legacyUuid("doc", docSrl), uploader, `${uploader}/xe/${f.file_srl}.${ext}`, String(f.source_filename ?? `file-${f.file_srl}`).slice(0, 250),
      Math.max(1, Number(f.file_size) || 1), MIME[ext] ?? "application/octet-stream", Number(f.file_srl), xeDate(f.regdate) ?? new Date().toISOString()]);
  }
  log(`files: ${files.length} valid, ${attRows.length} attachable`);

  // ===== 3. static pages =====
  if (ONLY.includes("pages")) {
    const modBySrl = new Map(modules.map((m) => [m.mid, Number(m.module_srl)]));
    let n = 0;
    for (const [slug, mids] of Object.entries(MAP.staticPages)) {
      if (slug.startsWith("_")) continue;
      const srls = mids.map((m) => modBySrl.get(m)).filter(Boolean);
      if (srls.length === 0) continue;
      const rows = await q(`select content, last_update from xe_documents where module_srl in (?) order by last_update desc limit 1`, [srls]);
      if (!rows[0]) continue;
      const html = legacyHtml(rows[0].content, pathToAttId);
      const r = await pgc.query("update static_pages set content=$2, updated_by=$3, updated_at=coalesce($4, now()) where slug=$1", [slug, html, SYSTEM_ID, xeDate(rows[0].last_update)]);
      n += r.rowCount;
    }
    stats.pages = { source: Object.keys(MAP.staticPages).filter((k) => !k.startsWith("_")).length, target: n };
    log(`pages done: ${n}`);
  }

  // ===== 4. posts =====
  if (ONLY.includes("posts")) {
    const extra = new Map();
    for (const v of await q("select document_srl, eid, value from xe_document_extra_vars where eid is not null and eid<>''"))
      (extra.get(Number(v.document_srl)) ?? extra.set(Number(v.document_srl), []).get(Number(v.document_srl))).push(v);
    const total = (await q("select count(*) as n from xe_documents where status='PUBLIC'"))[0].n;
    let last = 0, n = 0;
    const COLS = ["id", "board_id", "author_id", "title", "content", "content_html", "is_notice", "view_count", "event_date", "event_start", "event_end", "legacy_document_srl", "created_at", "updated_at"];
    const TYPES = ["uuid", "uuid", "uuid", "text", "text", "boolean", "boolean", "int", "date", "timestamptz", "timestamptz", "bigint", "timestamptz", "timestamptz"];
    while (true) {
      const docs = await q(`select document_srl, module_srl, member_srl, title, content, is_notice, readed_count, regdate, last_update
        from xe_documents where status='PUBLIC' and document_srl > ? order by document_srl limit 300`, [last]);
      if (docs.length === 0) break;
      const rows = [];
      for (const d of docs) {
        last = Number(d.document_srl);
        const boardId = boardOfModule.get(Number(d.module_srl));
        if (!boardId) continue; // page/faq 모듈 문서 등
        const ev = Object.fromEntries((extra.get(last) ?? []).filter((v) => v.eid.startsWith("ext_plan_")).map((v) => [v.eid, String(v.value)]));
        const eventDate = ymd(ev.ext_plan_start);
        let eventStart = null, eventEnd = null;
        if (eventDate) {
          const [ts, te] = (ev.ext_plan_time ?? "").split("|@|");
          const endDate = ymd(ev.ext_plan_end) ?? eventDate;
          if (/^\d{2}:\d{2}$/.test(ts ?? "")) {
            eventStart = `${eventDate}T${ts}:00+09:00`;
            eventEnd = /^\d{2}:\d{2}$/.test(te ?? "") ? `${endDate}T${te}:00+09:00` : null;
            if (eventEnd && Date.parse(eventEnd) <= Date.parse(eventStart)) eventEnd = null;
          }
        }
        const content = legacyHtml(d.content, pathToAttId) + extraVarsTable(extra.get(last) ?? []);
        rows.push([legacyUuid("doc", last), boardId, profileOf(d.member_srl), String(d.title ?? "").trim().slice(0, 200) || "(제목 없음)",
          content, false, d.is_notice === "Y", Number(d.readed_count) || 0, eventDate, eventStart, eventEnd, last,
          xeDate(d.regdate) ?? new Date().toISOString(), xeDate(d.last_update) ?? xeDate(d.regdate) ?? new Date().toISOString()]);
        if (LIMIT && ++n >= LIMIT) break;
      }
      await bulk(pgc, "posts", COLS, rows, "legacy_document_srl", COLS.filter((c) => c !== "id" && c !== "legacy_document_srl"), TYPES);
      log(`posts ${Math.min(n || last, total)} (srl ${last})`);
      if (LIMIT && n >= LIMIT) break;
    }
    const cnt = (await pgc.query("select count(*)::int as n from posts where legacy_document_srl is not null")).rows[0].n;
    stats.posts = { source: Number(total), target: cnt };
    log(`posts done: ${cnt}`);
  }

  // ===== 5. comments =====
  if (ONLY.includes("comments")) {
    const parentOf = new Map((await q("select comment_srl, parent_srl from xe_comments")).map((r) => [Number(r.comment_srl), Number(r.parent_srl)]));
    const rootOf = (srl) => { let p = parentOf.get(srl) || 0, guard = 0; let cur = srl; while (p && guard++ < 50) { cur = p; p = parentOf.get(p) || 0; } return cur === srl ? 0 : cur; };
    const migratedPosts = new Set((await pgc.query("select legacy_document_srl from posts where legacy_document_srl is not null")).rows.map((r) => Number(r.legacy_document_srl)));
    const total = (await q("select count(*) as n from xe_comments where status=1 and is_secret='N'"))[0].n;
    const COLS = ["id", "post_id", "author_id", "parent_id", "content", "legacy_comment_srl", "created_at", "updated_at"];
    const TYPES = ["uuid", "uuid", "uuid", "uuid", "text", "bigint", "timestamptz", "timestamptz"];
    let last = 0, n = 0, skipped = 0;
    while (true) {
      const cs = await q(`select comment_srl, document_srl, member_srl, content, regdate, last_update from xe_comments
        where status=1 and is_secret='N' and comment_srl > ? order by comment_srl limit 1000`, [last]);
      if (cs.length === 0) break;
      const rows = [];
      for (const c of cs) {
        last = Number(c.comment_srl);
        const doc = Number(c.document_srl);
        if (!migratedPosts.has(doc)) { skipped++; continue; }
        let text = htmlToText(c.content);
        if (text.length === 0) text = "(내용 없음)";
        if (text.length > 4000) text = text.slice(0, 3990) + "…(절단)";
        const root = rootOf(last);
        rows.push([legacyUuid("comment", last), legacyUuid("doc", doc), profileOf(c.member_srl), root ? legacyUuid("comment", root) : null,
          text, last, xeDate(c.regdate) ?? new Date().toISOString(), xeDate(c.last_update) ?? xeDate(c.regdate) ?? new Date().toISOString()]);
        if (LIMIT && ++n >= LIMIT) break;
      }
      // 부모 댓글이 같은 배치에 없을 수 있으므로 부모 없는 것 먼저, 그다음 대댓글
      await bulk(pgc, "comments", COLS, rows.filter((r) => !r[3]), "legacy_comment_srl", COLS.filter((c) => c !== "id" && c !== "legacy_comment_srl"), TYPES);
      const replies = rows.filter((r) => r[3]);
      if (replies.length) {
        const have = new Set((await pgc.query("select id from comments where id = any($1::uuid[])", [replies.map((r) => r[3])])).rows.map((r) => r.id));
        for (const r of replies) if (!have.has(r[3])) r[3] = null; // 부모가 비밀·삭제 댓글이면 최상위로
        await bulk(pgc, "comments", COLS, replies, "legacy_comment_srl", COLS.filter((c) => c !== "id" && c !== "legacy_comment_srl"), TYPES);
      }
      log(`comments ${Math.min(n || last, total)} (srl ${last})`);
      if (LIMIT && n >= LIMIT) break;
    }
    const cnt = (await pgc.query("select count(*)::int as n from comments where legacy_comment_srl is not null")).rows[0].n;
    stats.comments = { source: Number(total), target: cnt, skippedNoPost: skipped };
    log(`comments done: ${cnt}`);
  }

  // ===== 6. attachments (메타) =====
  if (ONLY.includes("files")) {
    const migratedPosts = new Set((await pgc.query("select id from posts where legacy_document_srl is not null")).rows.map((r) => r.id));
    let rows = attRows.filter((r) => migratedPosts.has(r[1]));
    if (LIMIT) rows = rows.slice(0, LIMIT);
    const COLS = ["id", "post_id", "uploader_id", "storage_path", "file_name", "byte_size", "mime_type", "legacy_file_srl", "created_at"];
    const TYPES = ["uuid", "uuid", "uuid", "text", "text", "bigint", "text", "bigint", "timestamptz"];
    for (let i = 0; i < rows.length; i += 2000) {
      await bulk(pgc, "attachments", COLS, rows.slice(i, i + 2000), "legacy_file_srl", COLS.filter((c) => c !== "id" && c !== "legacy_file_srl"), TYPES);
      log(`attachments ${Math.min(i + 2000, rows.length)}/${rows.length}`);
    }
    const cnt = (await pgc.query("select count(*)::int as n from attachments where legacy_file_srl is not null")).rows[0].n;
    stats.attachments = { source: files.length, attachable: attRows.length, target: cnt };
    log(`attachments done: ${cnt} (파일 본체는 npm run xe:files 로 복사)`);
  }
} finally {
  await pgc.query("alter table public.profiles enable trigger trg_profiles_guard_role").catch(() => {});
  await pgc.end();
  await xe.end();
}
console.log("\n== 결과 (원본 → 대상)");
console.table(stats);
