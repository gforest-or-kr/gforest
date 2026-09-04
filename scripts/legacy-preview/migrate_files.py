#!/usr/bin/env python3
"""첨부 이관: 브라우저 세션 다운로드 → Storage 업로드 → attachments 행 (멱등)"""
# [미사용] 2026-06 Supabase 프리뷰 ETL. RDS/S3 백엔드에서는 실행 불가.
import json, os, subprocess, base64, mimetypes, re, urllib.request, urllib.parse, time

SUPA = "https://ifqgenuuwuxiqndpcjea.supabase.co"
KEY = os.environ["SUPABASE_SECRET_KEY"]
DBURL = os.environ["SUPABASE_DB_URL"]
MAX_PER_POST = 3
MAX_MB = 5

def psql(sql):
    r = subprocess.run(["docker","exec","-i","cndy26-timescaledb","psql",DBURL,"-tA","-v","ON_ERROR_STOP=1"],
                       input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:300])
    return r.stdout.strip()

def size_mb(s):
    m = re.match(r"([\d.]+)\s*(KB|MB|B)", s, re.I)
    if not m: return 99
    v = float(m.group(1)); u = m.group(2).upper()
    return v/1024 if u=="KB" else (v if u=="MB" else v/1024/1024)

def fetch_b64(url):
    js = ('fetch("' + url.replace("&amp;","&") + '",{credentials:"include"}).then(r=>r.arrayBuffer()).then(b=>{'
          'const u=new Uint8Array(b);let s="";for(let i=0;i<u.length;i+=8192)'
          '{s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));}return btoa(s)})')
    r = subprocess.run(["cmux","browser","surface:18","eval",js], capture_output=True, text=True, timeout=180)
    raw = r.stdout.strip()
    if not raw or raw.startswith("Error"): return None
    return base64.b64decode(raw)

existing = set(psql("select legacy_file_srl from public.attachments where legacy_file_srl is not null").splitlines())
data = json.load(open("/tmp/gforest-crawl/parsed.json"))
ok = skip = fail = 0

for slug, posts in data["boards"].items():
    for p in posts:
        for f in p["files"][:MAX_PER_POST]:
            if str(f["file_srl"]) in existing: skip += 1; continue
            if size_mb(f["size"]) > MAX_MB:
                print(f"  크기 초과 스킵: {f['name']} ({f['size']})"); skip += 1; continue
            blob = fetch_b64(f["url"])
            if not blob or len(blob) < 100 or blob[:6] == b"<!DOCT":
                print(f"  다운로드 실패: {f['name']}"); fail += 1; continue
            mime = mimetypes.guess_type(f["name"])[0] or "application/octet-stream"
            ext = re.sub(r"[^A-Za-z0-9.]", "", f["name"].rsplit(".", 1)[-1])[:8] if "." in f["name"] else "bin"
            path = f"legacy/{f['file_srl']}/file.{ext}"  # Storage 키는 ASCII만 — 원본명은 DB file_name에
            req = urllib.request.Request(
                f"{SUPA}/storage/v1/object/attachments/{urllib.parse.quote(path)}",
                data=blob, method="POST",
                headers={"apikey": KEY, "Authorization": f"Bearer {KEY}",
                         "Content-Type": mime, "x-upsert": "true"})
            try:
                urllib.request.urlopen(req)
            except Exception as e:
                print(f"  업로드 실패 {f['name']}: {e}"); fail += 1; time.sleep(2); continue
            name_q = f["name"].replace("'", "''"); path_q = path.replace("'", "''")
            psql(
                "insert into public.attachments (post_id, uploader_id, storage_path, file_name, byte_size, mime_type, legacy_file_srl)\n"
                f"select p.id, p.author_id, '{path_q}', '{name_q}', {len(blob)}, '{mime}', {f['file_srl']}\n"
                f"from public.posts p where p.legacy_document_srl={p['srl']}\n"
                "on conflict (legacy_file_srl) do nothing;")
            ok += 1
            time.sleep(0.3)

print(f"업로드 {ok}, 스킵 {skip}, 실패 {fail}")
print("DB rows:", psql("select count(*) from public.attachments"))
