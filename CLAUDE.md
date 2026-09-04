# gforest-web

푸른숲발도르프학교(gforest.or.kr) 홈페이지 재구축 — XE1 → Next.js + Postgres(AWS).
**최우선 가치: 유지보수에 손이 덜 가는 구조.** 운영 주체는 전담 인력이 없는 비영리 학부모조합이다. 2026-09 Vercel/Supabase 프로토타입에서 **AWS(ECS Fargate + RDS + S3)** 로 이전했다(예산·근거: Confluence 02 리서치 "AWS 이전 예산·리소스 검토").

> **새 세션·팀원은 [`docs/conventions/README.md`](docs/conventions/README.md)부터 읽을 것** — 여러 세션(maestro 등)·팀원이 repo 접근만으로 맥락을 이어받는 협업 실무(how-to) 허브다. 이 CLAUDE.md는 *원칙*, `docs/conventions/`는 *작성법*: Jira 전환·Confluence 작성([atlassian.md](docs/conventions/atlassian.md)) / CI·CD 구조([cicd-and-ops.md](docs/conventions/cicd-and-ops.md)) / 코드 패턴([code-patterns.md](docs/conventions/code-patterns.md)).

## 스택

- Next.js (App Router, TypeScript, Tailwind v4) — Docker(standalone) 이미지로 **ECS Fargate(ARM64)** 에서 상시 실행
- **RDS Postgres 17** (RLS 그대로 사용) / **Auth.js(Credentials, JWT 쿠키)** / **S3** 미디어(presigned URL) — 모두 **Seoul(ap-northeast-2)**
- 인프라는 `infra/` Terraform(shared + env dev/prod), 배포는 `.github/workflows/ecs-deploy.yml`(main push → dev, 수동 → prod). 계정·접근 체계는 `docs/conventions/cicd-and-ops.md`
- 상세 설계: Confluence `gforest.atlassian.net` > 푸른숲-웹-마이그레이션 스페이스 / 이슈: Jira `GFM` 프로젝트

## 기술 원칙

1. **이식성 우선**: 표준 Postgres/SQL 중심(`pg` 드라이버, 파라미터 쿼리). ORM·클라우드 전용 기능 의존 최소화. `pg_dump` 하나로 탈출 가능해야 한다
2. **스키마는 코드로만 변경**: `supabase/migrations/*.sql`이 단일 진실(폴더명은 역사적 이유로 유지). 적용은 `infra/db/bootstrap.sh <env>`(순차 적용 + `schema_migrations` 추적). 콘솔 수동 변경 금지. `lib/db/types.ts`의 Row 타입을 함께 갱신
3. **권한은 DB가 강제한다**: 게시판 33개의 읽기/쓰기 권한은 `boards.read_roles[]/write_roles[]` 데이터 + RLS(`can_read_board`/`can_write_board`)로 처리. 앱은 RLS가 적용되는 `gforest_app` 롤로 접속하고 **모든 쿼리를 `withUser(userId, …)` 트랜잭션 안에서** 실행한다(`set_config('app.user_id')` → DB의 `auth.uid()`). **앱 코드에 권한 분기를 중복 구현하지 말 것** — UI 노출 제어용으로만 사용
4. **역할 모델**: `pending → member / operator / teacher / student / admin` (선형 계층 아님). 역할 변경은 admin 전용이며 트리거가 차단·감사한다
5. **단순함 유지**: 학부모조합 게시판이다. 과한 추상화·라이브러리 추가 지양. 게시판 추가/변경은 코드가 아니라 `boards` 데이터로 해결되어야 한다
6. **모바일 퍼스트 단일 반응형**: 별도 모바일 마크업 금지. 탭 타겟 44px+, 호버 의존 금지. 다크모드 미지원(확정). 디자인 토큰은 `app/globals.css`의 forest 팔레트
7. **서울 리전 고정**: 앱·DB·S3 모두 ap-northeast-2. `infra/`의 리전 변수를 바꾸지 말 것 — 앱↔DB 리전 불일치는 전 페이지 +1초 지연의 최다 원인
8. **이미지는 클라이언트 리사이즈(장변 1600px) 후 업로드**: S3 저장·전송 비용과 사용자 체감 속도 모두를 위해. 업로드는 `createUploadUrl` → presigned PUT
9. **렌더링 = 서버 렌더 + 공개 데이터 태그 캐시**: 상시 서버라 세션(`getSessionProfile()`)을 서버 컴포넌트·layout에서 읽어도 된다. 회원 게시판은 사용자 RLS 컨텍스트로 서버 렌더, 공개 데이터(`lib/boards.ts`·`lib/menu-data.ts`)는 `unstable_cache` + `revalidateTag(tag, "max")`. **`unstable_cache` 콜백 안에서는 세션을 읽지 말 것**(anon = `withUser(null, …)`). 클라이언트 컴포넌트는 DB·인증에 직접 접근하지 않고 서버 액션만 호출한다. 이력·근거는 `docs/design/rendering.md`

## 개발 워크플로

- **Jira 동기화**: 작업 시작 시 해당 GFM 이슈를 `진행 중`으로, 완료 시 `완료`(리뷰 필요 시 `검토 중`)로 전환. 없는 작업은 이슈를 먼저 만든다. Confluence 계획서의 진행 현황은 Jira 매크로로 자동 연동되므로 위키를 수동 갱신하지 않는다
- **커밋**: 관련 이슈 키를 메시지에 포함 (예: `feat: ... (GFM-2)`)
- **문서 역할 분담**: 코드·SQL·다이어그램 원본(`docs/diagrams/*.drawio`)은 repo가 단일 진실, Confluence는 설계 설명·협업용. 설계 변경 시 둘 다 갱신
- **Confluence 다이어그램**: PNG를 본문 기본 표시 + draw.io 매크로는 접기 블록 안 (모바일 앱이 서드파티 매크로를 렌더링하지 못함). 다이어그램 수정 시 PNG도 함께 갱신
- **비밀값**: `.env`(Atlassian 토큰)·`.env.local`(DB 접속 문자열 등)은 커밋 금지. 운영 비밀값은 SSM Parameter Store `/gforest/<env>/…`(Terraform `secret_parameters`로 태스크에 주입). 공유용 예시는 `.env.local.example`

## 운영 원칙 (배포 후)

1. **백업**: RDS 자동 백업(prod 7일, 스냅샷). 백업은 복원 검증까지 해야 백업이다 — 분기 1회 스냅샷 복원 테스트(절차 TODO)
2. **비용 상한**: AWS Budgets `gforest-monthly`(월 $110 기준, $36/$107/$179 알림). 리소스 추가 전 예산 문서와 대조
3. **root 봉인**: AWS root는 MFA·액세스 키 없음·일상 로그인 금지. 사람은 Identity Center, CI는 OIDC 롤. 장기 액세스 키는 어디에도 만들지 않는다
4. **신규 가입 = pending**: 관리자가 승인(역할 부여)해야 회원 기능 사용 가능 — 기존 등업게시판 워크플로의 대체. 이메일 인증은 두지 않는다(승인이 게이트)

## 주의사항

- XE 레거시 데이터의 `legacy_*` 컬럼(unique)은 ETL 멱등성의 키 — 삭제·변경 금지
- 운영위/교사/학생 게시판 권한 경계는 XE 관리자 확인(GFM-9) 전까지 추정값 (`supabase/seed.sql` 주석 참조)
- 협업 실무(Jira·Confluence 작성·CI/CD·코드 패턴)는 `docs/conventions/` 참조 — 다른 세션·팀원 온보딩 허브
- 마이그레이션 배경·기존 사이트 분석은 `docs/` 참조: `plans/migration_plan.md`(계획), `research/site_structure.md`(구조·권한), `design/screen_design.md`(화면), `design/db_schema.md`(스키마), `design/rendering.md`(렌더링 전략·ISR 함정·CI 게이트)
- 렌더·데이터 변경 후엔 dev 배포(main push 자동) 뒤 `https://dev.gforest.or.kr`에서 공개 글·회원 글·로그인을 눈으로 확인할 것. 빌드는 DB 없이 통과해야 한다(빌드 시점 DB 접근 금지 — CI `ci` 잡이 게이트)
