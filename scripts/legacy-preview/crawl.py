#!/usr/bin/env python3
"""XE 프리뷰 샘플 크롤러 — cmux 브라우저 세션(일반회원)으로 게시판별 최근 10글 수집"""
import base64, re, subprocess, time, json, os, sys

RAW = "/tmp/gforest-crawl/raw"
os.makedirs(RAW, exist_ok=True)
SURFACE = "surface:18"
PER_BOARD = 10
DELAY = 0.4  # 서버 부담 최소화

# slug -> legacy_mid (일반회원 접근 가능 31개)
BOARDS = {
    "qna": "board_QNA", "notice": "board_noti", "calendar": "board_cal",
    "story": "board_story", "exchange": "board_chg", "info": "board_info",
    "edu-data": "board_eduData1", "budget": "board_budset",
    "free": "board_free", "club": "board_circle", "market": "board_market",
    "library": "board_lib", "after-care": "board_after",
    "after-music": "board_Instruments", "orchestra": "board_Orche",
    "after-middle": "board_Xuvv80", "album": "board_album2",
    "links": "board_XoXa54", "parents": "board_parent",
    "parents-data": "board_Pdata", "parents-edu": "board_edudata",
    "career": "board_jinro", "minutes": "board_rec",
    "parents-assoc": "board_kPes34", "to-operators": "board_toOp1",
    "to-parents": "board_Mcow16", "approval": "board_pum",
    "reservation": "board_rsv", "level-up": "board_grade",
    "feedback": "board_bug", "yeoreum": "new_build",
}

JS = ('fetch("{url}",{{credentials:"include"}}).then(r=>r.arrayBuffer()).then(b=>{{'
      'const u=new Uint8Array(b);let s="";for(let i=0;i<u.length;i+=8192)'
      '{{s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));}}return btoa(s)}})')

def fetch(url_path, retries=3):
    for attempt in range(retries):
        try:
            out = subprocess.run(
                ["cmux", "browser", SURFACE, "eval", JS.format(url=url_path)],
                capture_output=True, text=True, timeout=60,
            )
            raw = out.stdout.strip()
            if raw and not raw.startswith("Error"):
                return base64.b64decode(raw).decode("utf-8", errors="replace")
        except Exception as e:
            print(f"  fetch err ({attempt+1}): {e}", flush=True)
        time.sleep(2)
    return None

def main():
    manifest = {}
    for slug, mid in BOARDS.items():
        print(f"[{slug}] {mid}", flush=True)
        lst = fetch(f"/xe/index.php?mid={mid}")
        if not lst:
            print("  목록 실패", flush=True); continue
        open(f"{RAW}/{mid}__list.html", "w").write(lst)
        # 권한/모듈 체크
        if "권한이 없습니다" in lst or "로그인이 필요" in lst:
            print("  접근 불가 — 건너뜀", flush=True); continue
        srls = []
        for m in re.finditer(rf'href="https://www\.gforest\.or\.kr/xe/{re.escape(mid)}/(\d+)"', lst):
            srl = m.group(1)
            if srl not in srls:
                srls.append(srl)
        # 공지(상단 고정 중복) 포함 상위 N개
        srls = srls[:PER_BOARD]
        print(f"  글 {len(srls)}건", flush=True)
        manifest[slug] = {"mid": mid, "srls": srls}
        for srl in srls:
            path = f"{RAW}/{mid}__{srl}.html"
            if os.path.exists(path):
                continue
            html = fetch(f"/xe/{mid}/{srl}")
            if html:
                open(path, "w").write(html)
            else:
                print(f"  {srl} 실패", flush=True)
            time.sleep(DELAY)
        json.dump(manifest, open("/tmp/gforest-crawl/manifest.json", "w"), ensure_ascii=False, indent=1)
    print("DONE", flush=True)

if __name__ == "__main__":
    main()
