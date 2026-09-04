# 프리뷰용 XE 샘플 이관 스크립트 (GFM-11)

> **1회성 프리뷰 ETL(2026-06, Supabase 대상).** 현재 백엔드(RDS·S3)에는 실행 불가 — 본 이관(P3.5)은 새 스크립트로 작성 예정.

조합원 프리뷰 공개용 임시 데이터 — **오픈 전 전체 삭제 후 GFM-7 본 ETL(DB dump)로 대체**.

## 흐름
1. `crawl.py` — cmux 브라우저 세션으로 게시판별 최근 10글 HTML 수집 (`/tmp/gforest-crawl/raw`)
2. `parse.py` — 제목/작성자(member_srl)/날짜/본문 HTML/댓글/첨부 파싱 → `parsed.json`
3. `migrate_users.py` — 작성자별 auth 사용자 생성 (`legacy{srl}@preview.invalid`) + `profiles.legacy_member_srl` 매핑
4. `migrate_posts.py` — 글·댓글 insert (`legacy_document_srl`/`legacy_comment_srl` 멱등)
5. `migrate_files.py` — 첨부 다운로드 → Storage `attachments/legacy/{file_srl}/` 업로드 (글당 3개·5MB 한도)

비밀값(DB URL·secret key)은 스크립트에 하드코딩되어 있던 것을 환경변수로 바꿔 쓸 것.

## XE 마크업 노트 (본 ETL에서 재활용)
- 목록: `<a href=".../xe/{mid}/{document_srl}" class="hx">`, 공지는 `<tr class="notice">`
- 본문: `<!--BeforeDocument(srl,n)-->…<!--AfterDocument-->`, 래퍼 `div.document_{srl}_{n}.xe_content`
- 작성자: `class="nick member_{member_srl}"` (게스트 글은 없음 → legacy_member_srl=0 placeholder)
- 댓글: `li#comment_{srl}` + `<!--BeforeComment-->`, 첨부: `div#files_{srl}` 테이블
- 본문 이미지는 기존 사이트 절대경로 핫링크로 둠 (프리뷰 한정 — 본 ETL에서 Storage 이관 필요)

## 정리(오픈 전)
```sql
delete from posts where legacy_document_srl is not null;  -- comments/attachments cascade
delete from auth.users where email like '%@preview.invalid';
-- Storage: attachments/legacy/ 폴더 삭제
```
