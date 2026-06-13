# gforest-web

푸른숲발도르프학교(gforest.or.kr) 홈페이지 재구축 — XE1 → Next.js + Supabase.
**최우선 가치: 유지보수에 손이 덜 가는 구조.** 운영 주체는 전담 인력이 없는 비영리 학부모조합이며, 월 0원(무료 티어) 운영이 목표다.

> **새 세션·팀원은 [`docs/conventions/README.md`](docs/conventions/README.md)부터 읽을 것** — 여러 세션(maestro 등)·팀원이 repo 접근만으로 맥락을 이어받는 협업 실무(how-to) 허브다. 이 CLAUDE.md는 *원칙*, `docs/conventions/`는 *작성법*: Jira 전환·Confluence 작성([atlassian.md](docs/conventions/atlassian.md)) / CI·CD 구조([cicd-and-ops.md](docs/conventions/cicd-and-ops.md)) / 코드 패턴([code-patterns.md](docs/conventions/code-patterns.md)).

## 스택

- Next.js (App Router, TypeScript, Tailwind v4) + Vercel Hobby
- Supabase: Postgres / Auth / Storage / RLS — **Seoul(ap-northeast-2) 리전**
- 상세 설계: Confluence `gforest.atlassian.net` > 푸른숲-웹-마이그레이션 스페이스 / 이슈: Jira `GFM` 프로젝트

## 기술 원칙

1. **이식성 우선**: 표준 Postgres/SQL 중심. Supabase 전용 기능(Edge Functions 등) 의존 최소화. `pg_dump` 하나로 탈출 가능해야 한다
2. **스키마는 코드로만 변경**: `supabase/migrations/*.sql`이 단일 진실. 대시보드 수동 변경 금지. 스키마 변경 후 `supabase gen types typescript`로 타입 재생성
3. **권한은 DB가 강제한다**: 게시판 33개의 읽기/쓰기 권한은 `boards.read_roles[]/write_roles[]` 데이터 + RLS(`can_read_board`/`can_write_board`)로 처리. **앱 코드에 권한 분기를 중복 구현하지 말 것** — UI 노출 제어용으로만 사용
4. **역할 모델**: `pending → member / operator / teacher / student / admin` (선형 계층 아님). 역할 변경은 admin 전용이며 트리거가 차단·감사한다
5. **단순함 유지**: 학부모조합 게시판이다. 과한 추상화·라이브러리 추가 지양. 게시판 추가/변경은 코드가 아니라 `boards` 데이터로 해결되어야 한다
6. **모바일 퍼스트 단일 반응형**: 별도 모바일 마크업 금지. 탭 타겟 44px+, 호버 의존 금지. 다크모드 미지원(확정). 디자인 토큰은 `app/globals.css`의 forest 팔레트
7. **서울 리전 고정**: `vercel.json`의 `regions: ["icn1"]`을 제거하지 말 것 — 함수↔DB 리전 불일치는 전 페이지 +1초 지연의 최다 원인
8. **이미지는 클라이언트 리사이즈(장변 1600px) 후 업로드**: Storage 1GB·egress 5GB/월이 가장 먼저 닿는 한도다
9. **렌더링 = 정적 셸 + 클라 개인화. layout과 ISR(●) 페이지에서 쿠키를 읽지 말 것**: `app/layout.tsx`가 포함하는 서버 컴포넌트(특히 `Header`)나 ISR로 만들 페이지가 `cookies()`/`headers()`/`getSessionProfile()`(쿠키 기반) 등 요청 스코프 동적 API를 호출하면, 그 페이지가 동적으로 끌려 내려가고 ISR 페이지는 **런타임에 `DYNAMIC_SERVER_USAGE`로 500**이 된다. **dev·`next build`는 통과하고 프로덕션에서만 터지므로** 특히 위험하다. 로그인 상태·역할 같은 개인화는 클라이언트(`createClient().auth.getClaims()` + `useEffect`)에서 가져온다 — 예: `Header`(서버, 공개 메뉴만) → `HeaderNav`(클라, 세션). 상세·재현법·CI 게이트는 `docs/design/rendering.md` 참조

## 개발 워크플로

- **Jira 동기화**: 작업 시작 시 해당 GFM 이슈를 `진행 중`으로, 완료 시 `완료`(리뷰 필요 시 `검토 중`)로 전환. 없는 작업은 이슈를 먼저 만든다. Confluence 계획서의 진행 현황은 Jira 매크로로 자동 연동되므로 위키를 수동 갱신하지 않는다
- **커밋**: 관련 이슈 키를 메시지에 포함 (예: `feat: ... (GFM-2)`)
- **문서 역할 분담**: 코드·SQL·다이어그램 원본(`docs/diagrams/*.drawio`)은 repo가 단일 진실, Confluence는 설계 설명·협업용. 설계 변경 시 둘 다 갱신
- **Confluence 다이어그램**: PNG를 본문 기본 표시 + draw.io 매크로는 접기 블록 안 (모바일 앱이 서드파티 매크로를 렌더링하지 못함). 다이어그램 수정 시 PNG도 함께 갱신
- **비밀값**: `.env`(Atlassian 토큰)·`.env.local`(Supabase 키)은 커밋 금지. 공유용 예시는 `.env.local.example`

## 운영 원칙 (배포 후)

1. **백업**: GitHub Actions로 일 1회 `pg_dump` (Supabase Free는 자동 백업 없음). 백업은 복원 검증까지 해야 백업이다
2. **일시정지 방지**: 주 1회 keep-alive ping (Free 티어는 7일 무활동 시 DB 정지 — 방학이 위험 구간)
3. **비상업 유지**: 광고·후원 모금을 붙이는 순간 Vercel Hobby 약관 위반(Pro $20/월 강제). 도입 논의 시 호스팅 재검토 필요 — `docs/research/serverless_vs_selfhosted.md` 참조
4. **신규 가입 = pending**: 관리자가 승인(역할 부여)해야 회원 기능 사용 가능 — 기존 등업게시판 워크플로의 대체

## 주의사항

- XE 레거시 데이터의 `legacy_*` 컬럼(unique)은 ETL 멱등성의 키 — 삭제·변경 금지
- 운영위/교사/학생 게시판 권한 경계는 XE 관리자 확인(GFM-9) 전까지 추정값 (`supabase/seed.sql` 주석 참조)
- 협업 실무(Jira·Confluence 작성·CI/CD·코드 패턴)는 `docs/conventions/` 참조 — 다른 세션·팀원 온보딩 허브
- 마이그레이션 배경·기존 사이트 분석은 `docs/` 참조: `plans/migration_plan.md`(계획), `research/site_structure.md`(구조·권한), `design/screen_design.md`(화면), `design/db_schema.md`(스키마), `design/rendering.md`(렌더링 전략·ISR 함정·CI 게이트)
- ISR/렌더 관련 변경 후엔 `scripts/isr-smoke.sh`로 글 상세 200을 확인할 것(배포 CI가 자동 실행하지만 로컬 선검증 권장). dev 서버로는 ISR 오류가 안 잡힌다 — `next build && next start`로 봐야 한다
