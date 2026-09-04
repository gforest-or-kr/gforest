# gforest-web 마이그레이션 계획 (현행, 2026-09)

> XE1 사이트를 Next.js + AWS 로 옮기는 계획의 현행판. 원칙은 [CLAUDE.md](../../CLAUDE.md), 절차는 [docs/conventions/](../conventions/README.md),
> 진행 상태는 Jira `GFM`(Confluence 계획서 페이지가 Jira 매크로로 연동). 2026-06 최초 계획과 프로토타입 검토 기록은 Confluence **02 리서치** 에만 있다.

## 1. 개요

- **대상**: https://gforest.or.kr/xe/ — 학부모조합이 운영하는 학교 홈페이지. 컷오버 전까지 cafe24 에서 그대로 운영.
- **목표**: 지원 종료된 XE1 사이트를 **유지보수에 손이 덜 가는 구조**로 재구축. 일회성 개발이 아니라 인수인계 가능한 구조가 최우선.
- **운영 주체**: 비영리 학부모조합, 전담 인력 없음 → 서버 관리 업무를 최소화(관리형 서비스, Terraform·CI 로 재현 가능).
- **비용**: AWS 월 ~$110 상한(Budgets `gforest-monthly`). 근거는 Confluence 02 리서치 "AWS 이전 예산·리소스 검토".

## 2. AS-IS (XE1)

- XpressEngine 1.x + ksodesign 제이드(Jade) 템플릿, 게시판 33개 중심. 구조·권한 분석은 [docs/research/site_structure.md](../research/site_structure.md).
- XE1 은 2019년 1.11.6 을 끝으로 개발·지원 종료. XSS 포함 취약점 다수 → 회원 개인정보 보유 사이트이므로 현상 유지 불가.
- 보유 데이터: 회원, 게시글, 댓글, 첨부파일 (cafe24 MySQL).

## 3. TO-BE 아키텍처 (AWS)

```
브라우저 → Route 53 → ALB(ACM HTTPS, 호스트 라우팅)
        → ECS Fargate(ARM64, 상시) : Next.js 서버 렌더 + 태그 캐시 + Server Actions
        → RDS Postgres 17 (RLS 로 권한 강제) / S3 미디어 (presigned URL)
```

| 레이어 | 선택 | 비고 |
|---|---|---|
| 앱 | Next.js (App Router, TypeScript, Tailwind v4) | 별도 백엔드 없음. Docker standalone 이미지 |
| 실행 | ECS Fargate + ALB, 서울 리전 | dev 0.25vCPU ×1, prod 0.5vCPU ×2. Terraform `infra/` |
| DB | RDS Postgres 17 | 스키마는 `db/migrations`, 권한은 `boards.read_roles/write_roles` + RLS |
| 인증 | Auth.js Credentials (이메일/비밀번호, JWT 쿠키, bcrypt) | 가입 = `pending`, 관리자 승인이 게이트 |
| 미디어 | S3 + presigned URL (`lib/storage.ts`) | 클라이언트 리사이즈(장변 1600px) 후 업로드 |
| 배포 | GitHub Actions → ECR → ECS | main 병합 = dev, `vX.Y.Z` 태그 = prod |
| 환경 | dev `dev.gforest.or.kr` / prod `gforest.or.kr` | Terraform workspace, SSM 비밀값 |

### 운영 원칙

[CLAUDE.md](../../CLAUDE.md) 의 기술 원칙 9개·운영 원칙 4개가 단일 진실이다. 요약: 표준 Postgres 중심(이식성), 스키마는 코드로만,
권한은 DB(RLS)가 강제, 단순함 유지, 모바일 퍼스트, 서울 리전 고정, RDS 자동 백업 + 복원 검증, 비용 상한, root 봉인.

## 4. 데이터 이관 계획 (XE MySQL → RDS)

| XE 테이블 | 대상 | 비고 |
|---|---|---|
| `xe_member` | `auth.users` + `public.profiles` | 아래 비밀번호 항목 참조. `legacy_member_srl` 로 멱등 |
| `xe_member_group` | `profiles.role` | 운영진/교사/일반회원 매핑 — 경계는 GFM-9 확인 후 확정 |
| `xe_documents` | `public.posts` | `module_srl`/`category_srl` → `boards.slug` 매핑. `legacy_document_srl` |
| `xe_comments` | `public.comments` | 대댓글 계층(`parent_srl`) 보존. `legacy_comment_srl` |
| `xe_files` | S3 `attachments/…` + `public.attachments` | 업로드 후 본문 내 파일 경로 일괄 치환. `legacy_file_srl` |

- **비밀번호**: XE1 의 해시(MD5/SHA1 계열)는 bcrypt 로 변환할 수 없다 → XE 회원은 **컷오버 후 비밀번호 재설정** 이 필요하다.
  이메일 보유율 확인 → 재설정 안내(메일 + 로그인 화면 안내 문구) 준비. 이메일이 없는 회원은 관리자가 수동 처리.
- 프로토타입(2026-06~08) 기간에 가입·작성된 데이터는 **이미 dev RDS 로 옮겨져 있다**(bcrypt 해시 그대로, 미디어는 `db/tools/` 의 1회성 복사 스크립트). 컷오버 때 prod 에 같은 절차를 반복한다.
- ETL 은 **멱등**하게(`legacy_*` unique 컬럼이 키) 작성해 반복 실행 가능하게. 검증은 건수 대조 + 샘플 게시글/첨부 수동 확인.
- 이관·운영 작업 때만 RDS 를 잠깐 공개(`db_publicly_accessible` + 내 IP) 하고 닫는다.

## 5. 컷오버 절차 (개요)

1. **prod 인프라 apply** — `infra/env` workspace `prod` → `db/bootstrap.sh prod` → 회원·게시판 시드 확인.
2. **최종 이관** — XE 를 읽기 전용으로 전환 → §4 ETL 실행 → prod 데이터 검증(건수·샘플) → 프로토타입 데이터 최종 복사.
3. **Route 53 NS 전환** — cafe24 네임서버를 Route 53 존으로. TTL 을 미리 낮춰 둔다. ACM 인증서·ALB 호스트 규칙은 사전에 준비.
4. **검증** — `https://gforest.or.kr/version`, 공개 글·회원 글·로그인·글 작성·첨부·비밀번호 재설정. 첫 태그 `v1.0.0`.
5. **정리** — XE 사이트 정지(백업 보관), 프로토타입 인프라 폐기, `db/tools/` 의 1회성 복사 스크립트 삭제, 회원 비밀번호 재설정 안내 발송.

롤백은 NS 를 cafe24 로 되돌리는 것 — XE 데이터는 컷오버 후 일정 기간 보관한다.

## 6. 미확인 사항 → Jira

| 확인할 것 | Jira |
|---|---|
| XE 정확한 버전·DB 덤프 확보(phpMyAdmin 등), 회원·게시글·첨부 규모 | GFM-9 |
| 게시판별 접근 권한 정책(운영위/교사/학생 경계) — 확인 전까지 `db/seed.sql` 은 추정값 | GFM-9 |
| 회원 이메일 보유율(비밀번호 재설정 안내 가능 여부) | GFM-9 |
| 도메인 DNS 관리 권한 보유자(cafe24 계정) | GFM-9 |
| 전환 기간 중 기존 XE 사이트 처리(읽기 전용 기간, 보관 기간) | GFM-9 |
| 스냅샷 복원 테스트 절차(분기 1회) | 미생성 — 이슈 생성 필요 |
