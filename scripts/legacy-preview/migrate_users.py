#!/usr/bin/env python3
"""작성자 프로필 생성: auth admin API → legacy_member_srl 매핑 (멱등)"""
# [미사용] 2026-06 Supabase 프리뷰 ETL. RDS/S3 백엔드에서는 실행 불가.
import json, os, subprocess, urllib.request, secrets, time

SUPA = "https://ifqgenuuwuxiqndpcjea.supabase.co"
KEY = os.environ["SUPABASE_SECRET_KEY"]
DBURL = os.environ["SUPABASE_DB_URL"]

def psql(sql):
    r = subprocess.run(
        ["docker", "exec", "-i", "cndy26-timescaledb", "psql", DBURL, "-tA", "-v", "ON_ERROR_STOP=1"],
        input=sql, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:500])
    return r.stdout.strip()

authors = json.load(open("/tmp/gforest-crawl/parsed.json"))["authors"]

# 기존 매핑·닉네임 확보
existing = set(psql("select legacy_member_srl from public.profiles where legacy_member_srl is not null").splitlines())
taken = set(psql("select nickname from public.profiles").splitlines())

created = 0
for srl, nick in authors.items():
    if srl in existing:
        continue
    base = (nick or "옛글").strip()[:20]
    if len(base) < 2:
        base = base + "님"
    nickname = base
    n = 2
    while nickname in taken:
        suffix = str(n)
        nickname = base[: 20 - len(suffix)] + suffix
        n += 1
    taken.add(nickname)

    body = json.dumps({
        "email": f"legacy{srl}@preview.invalid",
        "password": secrets.token_urlsafe(18),
        "email_confirm": True,
        "user_metadata": {"nickname": nickname, "name": ""},
    }).encode()
    req = urllib.request.Request(
        f"{SUPA}/auth/v1/admin/users", data=body, method="POST",
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req) as resp:
            uid = json.load(resp)["id"]
    except urllib.error.HTTPError as e:
        print(f"  {srl} {nickname}: {e.read()[:120]}")
        continue
    psql(f"update public.profiles set legacy_member_srl={int(srl)} where id='{uid}'")
    created += 1
    time.sleep(0.15)

print(f"신규 {created} / 전체 작성자 {len(authors)}")
print(psql("select count(*) from public.profiles where legacy_member_srl is not null"), "명 매핑됨")
