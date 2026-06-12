#!/usr/bin/env python3
"""크롤링 HTML 파싱 → parsed.json (글/댓글/첨부/작성자)"""
import json, re, html as ihtml, os

RAW = "/tmp/gforest-crawl/raw"
manifest = json.load(open("/tmp/gforest-crawl/manifest.json"))

def sanitize(content: str) -> str:
    # 프리뷰용 최소 sanitize: script/style 제거, 이벤트 핸들러·javascript: 제거
    content = re.sub(r"<script\b.*?</script>", "", content, flags=re.S | re.I)
    content = re.sub(r"<style\b.*?</style>", "", content, flags=re.S | re.I)
    content = re.sub(r"\son\w+\s*=\s*\"[^\"]*\"", "", content, flags=re.I)
    content = re.sub(r"\son\w+\s*=\s*'[^']*'", "", content, flags=re.I)
    content = re.sub(r"href\s*=\s*([\"'])\s*javascript:[^\"']*\1", "href=\"#\"", content, flags=re.I)
    # 상대 경로 → 기존 사이트 절대 경로 (이미지 핫링크 — 프리뷰 한정)
    content = content.replace('src="./files/', 'src="https://www.gforest.or.kr/xe/files/')
    content = content.replace('src="/xe/', 'src="https://www.gforest.or.kr/xe/')
    content = content.replace('src="https://www.gforest.or.kr/xe/./files/', 'src="https://www.gforest.or.kr/xe/files/')
    return content.strip()

def parse_post(mid, srl):
    path = f"{RAW}/{mid}__{srl}.html"
    if not os.path.exists(path):
        return None
    src = open(path).read()

    t = re.search(r'<h1 class="np_18px"><a[^>]*>(.*?)</a></h1>', src, re.S)
    d = re.search(r'<span class="date m_no">([\d.: ]+)</span>', src)
    a = re.search(r'class="nick member_(\d+)"[^>]*>([^<]+)</a>', src)
    v = re.search(r'조회 수 <b>([\d,]+)</b>', src)
    c = re.search(
        rf'<!--BeforeDocument\({srl},\d+\)-->(.*?)<!--AfterDocument\({srl},\d+\)-->', src, re.S)
    if not (t and c):
        return None
    # xe_content 래퍼 안쪽만
    body = c.group(1)
    inner = re.match(r'\s*<div class="document_\d+_\d+ xe_content">(.*)</div>\s*$', body, re.S)
    if inner:
        body = inner.group(1)

    post = {
        "srl": int(srl),
        "title": ihtml.unescape(re.sub(r"\s+", " ", re.sub(
            r"</?(span|b|strong|font|em|i|u|s|div|p|a|br)\b[^>]*/?>", "", t.group(1), flags=re.I))).strip()[:200],  # XE는 제목에 스타일 태그 허용 — 텍스트만 추출
        "date": d.group(1).strip() if d else None,
        "member_srl": int(a.group(1)) if a else None,
        "nickname": ihtml.unescape(a.group(2)).strip() if a else "옛글",
        "views": int(v.group(1).replace(",", "")) if v else 0,
        "content": sanitize(body),
        "comments": [],
        "files": [],
    }

    # 첨부 (files_{srl} 블록 한정)
    fb = re.search(rf'<div id="files_{srl}"(.*?)</div>', src, re.S)
    if fb:
        for fm in re.finditer(
            r'href="(https://www\.gforest\.or\.kr/xe/\?module=file[^"]*file_srl=(\d+)[^"]*)"[^>]*title="\[File Size:([^/]+)/[^"]*"[^>]*>([^<]+)</a>',
            fb.group(1)):
            post["files"].append({
                "url": ihtml.unescape(fm.group(1)),
                "file_srl": int(fm.group(2)),
                "size": fm.group(3),
                "name": ihtml.unescape(fm.group(4)).strip(),
            })

    # 댓글
    for cm in re.finditer(
        r'<li id="comment_(\d+)"[^>]*>.*?class="member_(\d+)"[^>]*>([^<]+)</a>\s*'
        r'<span class="date">([\d.: ]+)</span>.*?'
        r'<!--BeforeComment\(\1,\d+\)-->(.*?)<!--AfterComment\(\1,\d+\)-->',
        src, re.S):
        body = cm.group(5)
        inner = re.match(r'\s*<div class="comment_\d+_\d+ xe_content">(.*)</div>\s*$', body, re.S)
        if inner:
            body = inner.group(1)
        # 댓글은 텍스트화 (신규 댓글과 동일하게 plain text 렌더)
        text = re.sub(r"<br\s*/?>", "\n", body)
        text = re.sub(r"</p>\s*<p[^>]*>", "\n", text)
        text = ihtml.unescape(re.sub(r"<[^>]+>", "", text)).strip()
        if not text:
            continue
        post["comments"].append({
            "srl": int(cm.group(1)),
            "member_srl": int(cm.group(2)),
            "nickname": ihtml.unescape(cm.group(3)).strip(),
            "date": cm.group(4).strip(),
            "text": text[:4000],
        })
    return post

out = {"boards": {}, "authors": {}}
for slug, info in manifest.items():
    mid = info["mid"]
    # 공지 srl (목록의 tr.notice)
    notice_srls = set()
    lp = f"{RAW}/{mid}__list.html"
    if os.path.exists(lp):
        lsrc = open(lp).read()
        for nm in re.finditer(r'<tr class="notice">.*?/xe/' + re.escape(mid) + r'/(\d+)"', lsrc, re.S):
            notice_srls.add(nm.group(1))
    posts = []
    for srl in info["srls"]:
        p = parse_post(mid, srl)
        if not p:
            continue
        p["is_notice"] = srl in notice_srls
        posts.append(p)
        if p["member_srl"]:
            out["authors"][str(p["member_srl"])] = p["nickname"]
        for cc in p["comments"]:
            out["authors"][str(cc["member_srl"])] = cc["nickname"]
    if posts:
        out["boards"][slug] = posts
    print(f"{slug}: {len(posts)}글, 댓글 {sum(len(p['comments']) for p in posts)}, 첨부 {sum(len(p['files']) for p in posts)}")

json.dump(out, open("/tmp/gforest-crawl/parsed.json", "w"), ensure_ascii=False, indent=1)
print("authors:", len(out["authors"]))
