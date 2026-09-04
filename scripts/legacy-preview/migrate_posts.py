#!/usr/bin/env python3
"""글·댓글 인서트 SQL 생성 + 실행 (legacy_* 멱등)"""
# [미사용] 2026-06 Supabase 프리뷰 ETL. RDS/S3 백엔드에서는 실행 불가.
import json, os, re, subprocess

DBURL = os.environ["SUPABASE_DB_URL"]
data = json.load(open("/tmp/gforest-crawl/parsed.json"))

def q(s):  # SQL 문자열 리터럴
    return "'" + s.replace("'", "''") + "'"

def ts(d):  # '2026.06.09 10:04' → timestamptz
    if not d:
        return "now()"
    m = re.match(r"(\d{4})\.(\d{2})\.(\d{2})(?: (\d{2}):(\d{2}))?", d)
    if not m:
        return "now()"
    date = f"{m.group(1)}-{m.group(2)}-{m.group(3)} {m.group(4) or '12'}:{m.group(5) or '00'}+09"
    return f"'{date}'"

lines = ["begin;"]
for slug, posts in data["boards"].items():
    for p in posts:
        author = f"(select id from public.profiles where legacy_member_srl={p['member_srl'] or 0})"
        lines.append(
            "insert into public.posts (board_id, author_id, title, content, is_notice, view_count, created_at, legacy_document_srl)\n"
            f"select b.id, {author}, {q(p['title'])}, {q(p['content'])}, {str(p['is_notice']).lower()}, {p['views']}, {ts(p['date'])}, {p['srl']}\n"
            f"from public.boards b where b.slug={q(slug)}\n"
            "on conflict (legacy_document_srl) do nothing;")
        for c in p["comments"]:
            lines.append(
                "insert into public.comments (post_id, author_id, content, created_at, legacy_comment_srl)\n"
                f"select p.id, (select id from public.profiles where legacy_member_srl={c['member_srl'] or 0}), {q(c['text'])}, {ts(c['date'])}, {c['srl']}\n"
                f"from public.posts p where p.legacy_document_srl={p['srl']}\n"
                "on conflict (legacy_comment_srl) do nothing;")
lines.append("commit;")
lines.append("select count(*) filter (where legacy_document_srl is not null) as legacy_posts from public.posts;")
lines.append("select count(*) filter (where legacy_comment_srl is not null) as legacy_comments from public.comments;")

sql = "\n".join(lines)
open("/tmp/gforest-crawl/posts.sql", "w").write(sql)
r = subprocess.run(
    ["docker", "exec", "-i", "cndy26-timescaledb", "psql", DBURL, "-v", "ON_ERROR_STOP=1"],
    input=sql, capture_output=True, text=True)
print(r.stdout[-400:] if r.returncode == 0 else "FAIL\n" + r.stderr[-800:])
