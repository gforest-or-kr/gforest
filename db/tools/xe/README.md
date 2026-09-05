# XE1(cafe24) → RDS/S3 이관 도구

원본 사이트(gforest.or.kr, XE 1.x)의 DB 덤프를 새 스키마로 옮긴다. **멱등** — `legacy_*` 컬럼(unique)을 키로
몇 번을 다시 돌려도 중복이 생기지 않고, 매핑을 바꾸면 덮어쓴다. 설정은 `mapping.json`, 실사 기록은 Jira GFM-82.

## 1. 원본 준비

1. phpMyAdmin(`https://www.gforest.or.kr/xe/phpMyAdmin/`) → DB `purunsup7` → 내보내기 → 사용자 정의, gzip, 아래 15개 테이블:
   `xe_member xe_member_group xe_member_group_member xe_modules xe_module_extra_vars xe_menu xe_menu_item xe_documents xe_document_extra_keys xe_document_extra_vars xe_document_categories xe_comments xe_comments_list xe_files xe_tags`
2. 받은 `*.sql.gz` 를 `db/tools/xe/dump/` 에 둔다(**gitignore — 개인정보**).
3. `docker compose --profile xe up -d xe` → 최초 기동 때 자동 임포트(MariaDB 10.6, `127.0.0.1:3307`, root/xe). 다시 임포트하려면 `docker compose --profile xe down -v xe` 후 재기동.

## 2. 실행

```sh
npm run db:up                                   # 대상(로컬 Postgres) 준비
npm run xe:etl -- --anonymize                   # 로컬/dev 용: 이름·닉네임·이메일·민감 확장변수 가명화
npm run xe:etl                                  # 실데이터 (컷오버 때 prod)
npm run xe:files -- --since 2024                # 첨부 복사: XE(HTTP) → S3/MinIO. --since 없으면 전량(약 30GB)
```

| 변수 | 기본값 | 뜻 |
|---|---|---|
| `XE_MYSQL_URL` | `mysql://root:xe@127.0.0.1:3307/purunsup7` | 원본 복제본 |
| `DATABASE_ADMIN_URL` | `postgresql://gforest_admin:gforest@localhost:5432/gforest` | 대상(관리자 롤 — RLS 우회 필요) |
| `XE_BASE_URL` | `https://www.gforest.or.kr/xe/` | 첨부 원본 HTTP 경로(`files/attach/...` 앞) |
| `MEDIA_BUCKET`, `S3_ENDPOINT`, `AWS_*` | `.env.local` | 첨부 복사 대상 |

옵션: `--only members,pages,posts,comments,files` (단계 선택), `--limit N` (문서·댓글·첨부 N건만 — 시험용).
dev 에 넣을 때(비상 절차로 RDS 를 잠깐 연 뒤, `docs/conventions/cicd-and-ops.md`):

```sh
export AWS_PROFILE=gforest
db/tools/xe/reset-env.sh dev                     # 기존 데이터 전부 삭제 → 시드·테스트 계정만 (prod 거부)
url=$(aws ssm get-parameter --with-decryption --name /gforest/dev/DATABASE_ADMIN_URL --query Parameter.Value --output text)
DATABASE_ADMIN_URL="$url" npm run xe:etl -- --anonymize
DATABASE_ADMIN_URL="$url" MEDIA_BUCKET=gforest-media-dev-106360388338 S3_ENDPOINT= AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= \
  npm run xe:files -- --since 2025              # .env.local 의 MinIO 값을 비워 SSO 자격증명으로 실제 S3 에
```
끝나면 RDS 를 즉시 닫는다. 2026-09-05 dev 투입 완료(ETL 3.5분, 첨부 2,228개 5분).

## 3. 무엇이 어떻게 옮겨지나

| XE | 신규 | 규칙 |
|---|---|---|
| `xe_member` + 그룹 | `auth.users` + `profiles` | 역할은 `mapping.json` `roleByGroup`(여러 그룹이면 높은 쪽). `is_admin=Y`→admin, `denied=Y`→pending, **730일 이상 미로그인 member→pending**. 비밀번호는 옮기지 않는다(md5 → 컷오버 후 재설정). 닉네임 20자 절단·중복 시 `_2`. 이메일 형식 불량은 `legacy-<srl>@invalid.gforest.or.kr` |
| 탈퇴·비회원 글 | 시스템 프로필 `탈퇴·익명회원` | 원 작성자를 알 수 없는 글·댓글·첨부의 author. `시스템` 프로필(admin)이 ETL 실행자로 감사 로그에 남는다 |
| `xe_modules`(board) | `boards` | `legacy_mid` 일치 → 그 게시판. 없으면 `archive`(관리자만 열람) 게시판을 만들어 모은다 |
| `xe_modules`(page) 문서 | `static_pages.content` | `mapping.json` `staticPages` |
| `xe_documents` | `posts` | `status=PUBLIC` 만(SECRET·TEMP 제외). 본문은 허용목록 sanitize(레거시용 넓은 허용: 표·이미지·style). 본문 속 `files/attach/...` 이미지는 `/dl/<첨부id>?inline=1` 로 치환. 태그 없는 본문은 문단으로 감싼다. 확장변수(품의서 등)는 본문 끝 표로 보존(가명화 모드에서는 민감 항목 마스킹). `ext_plan_start/end/time` → `event_date/event_start/event_end`. `readed_count`→`view_count`, `is_notice` |
| `xe_comments` | `comments` | HTML→텍스트, 4000자 절단, 대댓글 깊이 2 이상은 최상위 댓글 아래로 평탄화. 비밀댓글 제외 |
| `xe_files` | `attachments` + S3 | `isvalid=Y` 이고 대상 문서/댓글이 이관된 것만(댓글 첨부는 그 글에). 키 `attachments/<uploader>/xe/<file_srl>.<ext>`. 복사는 `copy-files.mjs` 가 HTTP 로 받아 PUT |

버리는 것: 카테고리·태그·조회 로그·포인트·쪽지·투표·스크랩·문서 수정 이력. 필요해지면 덤프에 있으니 나중에 추가 가능.

## 4. 검증

실행 끝에 원본/대상 건수 표가 출력된다. 추가로 dev 에서 눈으로: 공개 글 본문 이미지, 회의록(회원 게시판) 첨부 다운로드, 학교일정표 달력, 품의서 확장정보 표.
