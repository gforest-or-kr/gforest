# gforest-web — 학부모조합 학교 홈페이지 재구축

> 이 문서는 Claude.ai 사전 검토 대화(2026-06)의 결정사항을 정리한 것이다.
> Claude Code는 모든 작업 시 이 문서의 결정사항과 운영 원칙을 따른다.

## 1. 프로젝트 개요

- **대상**: https://gforest.or.kr/xe/ — 학부모조합이 운영하는 학교 홈페이지
- **목표**: XE1 기반 사이트를 서버리스 스택으로 재구축. **일회성 개발이 아닌, 유지보수에 손이 덜 가는 구조가 최우선 가치**
- **운영 주체**: 비영리 학부모조합. 전담 운영 인력 없음 → 서버 관리 업무 자체가 없어야 함
- **비용 목표**: 월 0원 (도메인 비용 제외), 무료 티어 내 운영

## 2. 현재 상태 (AS-IS)

- XpressEngine(XE) 1.x + ksodesign 제이드(Jade) 템플릿, 게시판 중심 사이트
- XE1은 2019년 1.11.6을 끝으로 개발·지원 종료. XSS 포함 보안 취약점 다수 → 회원 개인정보 보유 사이트이므로 현상 유지 불가
- 보유 데이터: 회원 정보, 게시글, 댓글, 첨부파일 (XE MySQL DB)

## 3. 아키텍처 결정 (TO-BE)

```
브라우저
  → Vercel (Next.js: 정적/ISR 페이지 + Server Actions)
  → Supabase (Postgres / Auth / Storage / RLS)
```

| 레이어 | 선택 | 비고 |
|---|---|---|
| 프론트 + 서버 로직 | Next.js (App Router, TypeScript) | 별도 백엔드 서버 없음 |
| 호스팅 | Vercel (Hobby) | 약관 이슈 시 Cloudflare Pages로 전환 가능하게 설계 |
| DB | Supabase Postgres, **Seoul(ap-northeast-2) 리전** | |
| 인증 | Supabase Auth (이메일/비밀번호) | 카카오 OAuth는 추후 옵션 |
| 파일 | Supabase Storage | 1GB 초과 시 R2 병행 검토 |
| 권한 | Postgres RLS 정책 | "본인 글만 수정" 등은 DB에서 강제 |
| 스타일 | Tailwind CSS | |

### 운영 원칙 (중요)

1. **이식성 우선**: 표준 Postgres/SQL 중심으로 작성. Supabase 전용 기능(Edge Functions 등) 의존 최소화. `pg_dump` 하나로 탈출 가능한 구조 유지
2. **스키마는 코드로**: Supabase CLI 마이그레이션(`supabase/migrations/*.sql`)으로 버전 관리. 대시보드에서 수동 스키마 변경 금지
3. **타입 동기화**: `supabase gen types typescript`로 DB 스키마 → TS 타입 자동 생성
4. **백업**: GitHub Actions로 일 1회 `pg_dump` (Free 티어는 자동 백업 없음)
5. **Free 티어 일시정지 방지**: 주 1회 ping cron (방학 중 1주 무트래픽 대비)
6. **단순함 유지**: 학부모조합 게시판이다. 과한 추상화·라이브러리 추가 지양

## 4. 데이터 마이그레이션 계획

XE1 MySQL 덤프에서 Supabase Postgres로 ETL 스크립트 작성:

| XE 테이블 | 대상 | 비고 |
|---|---|---|
| `xe_member` | `auth.users` + `public.profiles` | 아래 비밀번호 정책 참조 |
| `xe_documents` | `public.posts` | `module_srl`/`category_srl`로 게시판 구분 매핑 |
| `xe_comments` | `public.comments` | 대댓글 계층(`parent_srl`) 보존 |
| `xe_files` | Storage 버킷 업로드 | 업로드 후 본문 내 파일 경로 일괄 치환 |
| `xe_member_group` | `profiles.role` 등 | 운영진/일반회원 권한 매핑 |

- **비밀번호**: XE1은 MD5 계열 해시 → Supabase Auth로 이전 불가. **전 회원 비밀번호 재설정 메일 일괄 발송**으로 처리 (사전 공지 필요)
- ETL은 멱등(idempotent)하게 작성하여 반복 실행 가능하게 (원본 `*_srl`을 매핑 테이블로 보존)
- 마이그레이션 검증: 건수 대조 + 샘플 게시글/첨부파일 수동 확인

## 5. 인프라 셋업 체크리스트

> **(2026-06-11) 이 체크리스트는 Jira GFM 프로젝트로 이관됨** — 진행 상태는 Jira가 단일 진실이며,
> Confluence 계획서 페이지는 Jira 매크로로 실시간 연동된다. 아래 목록은 최초 계획 기록용.

- [ ] GitHub repo 생성 (코드 + 마이그레이션 SQL 모두 포함)
- [ ] Supabase 프로젝트 생성 (Seoul 리전), URL/anon key 확보
- [ ] `create-next-app` 스캐폴드 + `@supabase/supabase-js`, `@supabase/ssr`
- [ ] `supabase init` → 초기 스키마 마이그레이션 (profiles/posts/comments/RLS)
- [ ] Vercel에 repo Import, 환경변수 설정 → 자동 배포 확인
- [ ] Auth 설정: 이메일 템플릿 한글화, 리다이렉트 URL 등록
- [ ] GitHub Actions: pg_dump 백업 + keep-alive ping
- [ ] XE 데이터 ETL 스크립트 작성·실행·검증
- [ ] 도메인 gforest.or.kr DNS → Vercel 연결 (HTTPS 자동)
- [ ] 전 회원 비밀번호 재설정 안내 발송

## 6. 미확인 사항 (작업 전 사용자에게 확인할 것)

- [ ] 현재 XE 정확한 버전 및 DB 덤프 확보 여부 (호스팅 업체 phpMyAdmin 등)
- [ ] 회원 수, 게시글 수, 첨부파일 총 용량 (무료 티어 한도 판단용)
- [ ] 게시판 목록과 각각의 접근 권한 정책 (공개/회원전용/운영진전용)
- [ ] 회원 이메일 보유율 (비밀번호 재설정 메일 발송 가능 여부)
- [ ] Vercel Hobby 약관(비상업) 적합성 최종 판단 — 부적합 시 Cloudflare Pages
- [ ] 도메인 DNS 관리 권한 보유자
- [ ] 전환 기간 중 기존 XE 사이트 처리 (단기 Rhymix 업그레이드 병행 여부)
