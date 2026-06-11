# gforest-web

푸른숲발도르프학교(gforest.or.kr) 홈페이지 재구축 프로젝트.
지원 종료된 XpressEngine 1.x 사이트를 **Next.js + Supabase 서버리스 스택**으로 이전합니다.

> **핵심 가치**: 전담 운영 인력이 없는 비영리 학부모조합이 운영하므로,
> 서버 관리 업무가 없고(월 0원, 무료 티어) 유지보수에 손이 덜 가는 구조가 최우선입니다.

## 스택

| 레이어 | 선택 |
|---|---|
| 프론트 + 서버 로직 | Next.js (App Router, TypeScript, Tailwind v4) |
| 호스팅 | Vercel Hobby — 서울 리전(`icn1`) 고정 |
| DB / 인증 / 파일 | Supabase (Postgres + RLS / Auth / Storage) — Seoul 리전 |

## 로컬 개발

```bash
npm install
cp .env.local.example .env.local   # Supabase URL/anon key 입력 (없어도 실행은 됨)
npm run dev                        # http://localhost:3000
```

- Node 20+ 필요
- Supabase 키가 없으면 인증 미들웨어는 자동으로 스킵됩니다 (UI 개발 가능)
- DB 스키마: `supabase/migrations/` + 게시판 시드 `supabase/seed.sql`

## 디렉터리

```
app/            Next.js App Router 페이지
lib/supabase/   Supabase 클라이언트 (browser/server/middleware)
supabase/       마이그레이션 SQL + 시드 (스키마의 단일 진실)
mockups/        화면설계 기반 HTML 목업 (python3 -m http.server로 열람)
docs/
├─ plans/       마이그레이션 계획서
├─ research/    기존 사이트 분석·권한 매트릭스·호스팅 비교
├─ design/      화면설계서·DB 스키마 설계
└─ diagrams/    draw.io 원본 (아키텍처·ERD)
```

## 협업

- **이슈/진행 관리**: [Jira GFM 프로젝트](https://gforest.atlassian.net/jira/software/projects/GFM/boards/1) — 모든 작업은 이슈로 추적
- **설계 문서**: [Confluence 푸른숲-웹-마이그레이션](https://gforest.atlassian.net/wiki/spaces/gforestMigration/overview) — 계획·분석·화면설계
- **개발 원칙**: [CLAUDE.md](./CLAUDE.md) — 기술·운영 원칙과 워크플로 (기여 전 필독)

## 라이선스 / 운영

비영리 학부모조합 내부 프로젝트입니다. 광고·상업적 사용 불가(Vercel Hobby 약관).
