# CI/CD · 운영 구조

> repo 접근만으로 배포·백업·모니터링이 어떻게 도는지 이해하기 위한 문서.
> 시각 다이어그램과 팀 전용 상세는 Confluence **05 운영 > "CI/CD 구성"**·"인프라·자격증명
> 레퍼런스". 여기는 repo 안에서 자급되는 요약 + 실제로 겪은 함정.

## 배포 = GitHub Actions CI (Vercel Git 연동 아님)

Vercel 대시보드의 Git 자동 배포는 **해제**돼 있다. 대신 `.github/workflows/deploy.yml`이
토큰으로 배포한다.

- **왜**: Vercel Hobby는 **프로젝트 소유자 외 계정의 커밋을 배포 차단**한다("Deployment was
  blocked"). 토큰 기반 CI 배포는 커밋 author와 무관 → **협업자 누구나 push/머지로 배포**된다.
- **트리거**: `main` push = **production**, PR = **preview**(PR에 URL 코멘트), `workflow_dispatch` 수동.
- **흐름**: `vercel pull` → `vercel build` → **ISR 스모크 게이트** → `vercel deploy --prebuilt` → Discord 알림.

## 브랜치·병합 전략 (squash 전용, 2026-06-19)

`main`이 production 단일 트렁크. 모든 작업은 **기능 브랜치 → PR → squash 병합**으로 들어간다.

- **브랜치명**: `feat/` · `perf/` · `fix/` · `docs/` · `chore/` + 짧은 설명 (예: `feat/design-a-prototype`).
- **병합은 squash만** — 리포 설정에서 **merge commit·rebase 비활성**. `gh pr merge --squash` 또는 GitHub UI의 Squash 버튼만 쓸 수 있다. 병합 후 브랜치는 **자동 삭제**, main 히스토리는 기능당 1커밋(선형).
- **PR 제목 = 커밋 컨벤션으로 작성** (`feat:`/`perf:`/`docs:` … + 관련 `GFM-키`). squash 설정이 **커밋 제목을 PR 제목으로 고정**하므로, PR 제목이 그대로 main 커밋 제목이자 **Discord 배포 알림 문구**가 된다.
- **왜 merge commit이 아닌가**: `--merge`는 `Merge pull request #N from …`가 main 최신 커밋이 돼, `deploy.yml`이 `head_commit.message` 첫 줄을 띄우는 Discord 알림이 **비설명적**이 된다. squash면 PR 제목이 알림에 떠 설명적으로 유지된다(근본 원인=병합 전략을 바꾼 업계 통상 방식, 워크플로 수정 불필요).

## 워크플로 3종

| 파일 | 트리거 | 역할 |
|---|---|---|
| `deploy.yml` | push main / PR / dispatch | 빌드 + ISR 스모크 게이트 + 배포 + Discord 알림 |
| `db-backup.yml` | 매일 03:00 KST (cron) | `pg_dump`(public+auth) → **스크래치 DB에 실제 복원 → 행수 대조** → 아티팩트 30일. 실패 시 Discord 🚨 |
| `keep-alive.yml` | 월·목 09:00 KST | REST 쿼리로 DB 활동 발생 (Free 7일 무활동 정지 방지) |

**ISR 스모크 게이트** (`scripts/isr-smoke.sh`): 배포 직전 `next build && next start`로 글 상세가
HTTP 200 + 제목 렌더 + `DYNAMIC_SERVER_USAGE` 부재인지 검증. 실패 시 배포 중단. **dev 서버로는
ISR 오류가 안 잡히므로**(dev는 항상 동적) 이 게이트가 프로덕션 500을 막는 최후 방어선이다. 배경은
`docs/design/rendering.md`.

## Secrets (이름만 — 값은 Confluence 인프라 페이지)

GitHub → Settings → Secrets and variables → Actions:

| 이름 | 용도 |
|---|---|
| `VERCEL_TOKEN` · `VERCEL_ORG_ID` · `VERCEL_PROJECT_ID` | CI 배포 인증·대상 |
| `SUPABASE_DB_URL` | 백업용 풀러 접속 문자열(비밀번호 포함) |
| `DISCORD_WEBHOOK_URL` | 알림 발송 |

## 모니터링 · 알림

- **UptimeRobot**(무료): production에 5분 간격 핑 → **워밍(콜드 스타트 빈도↓) + 다운 감지**.
  상태 페이지는 조합원 공유용. 다운 시 Discord로도 알림.
- **Discord 채널 알림**: ✅🚨 배포 결과 / 🚨 백업·keep-alive 실패 / 🔴 사이트 다운.
  (커밋·PR Discord 알림은 중복이라 **비활성**됨 — GitHub repo 웹훅 삭제.)

## DB 마이그레이션 (자동 적용, GFM-60)

스키마 변경의 단일 진실은 `supabase/migrations/*.sql`. **이제 prod DB 적용은 배포 CI가 자동으로 한다**(과거엔 수동 psql이라 mig3·4가 누락돼 첨부·슬라이드 업로드가 깨졌던 드리프트 사고가 있었다).

- `deploy.yml`이 코드 빌드 **전에** `supabase db push --db-url "$SUPABASE_DB_URL" --yes`를 실행(push=production에서만; PR preview는 공유 prod DB를 안 건드리도록 제외).
- 적용 이력은 `supabase_migrations.schema_migrations` 테이블이 추적 — 아직 안 올라간 마이그레이션만 골라 적용한다. 실패하면 잡이 죽어 배포가 막힌다(스키마 불일치 차단).
- **베이스라인(1회성, 완료)**: 기존 mig1~8은 순수 psql로 적용돼 추적 테이블이 없었다. 그대로 push하면 전부 재적용하다 충돌하므로 `schema_migrations`에 mig1~8 버전을 "기적용"으로 선등록했다. 이후부터는 새 마이그레이션만 자동 적용된다.
- **새 마이그레이션 작성법**: `supabase/migrations/`에 `<14자리>_name.sql` 추가(기존 `0000…NN` 접두사 이어가기) → main에 push하면 CI가 적용. 로컬 선검증: `npx supabase db push --db-url <세션풀러 URL> --dry-run`.
- **필요 시크릿**: `SUPABASE_DB_URL` = 세션 풀러 연결문자열(비밀번호 percent-encoded), 포트 5432. 직접 호스트(db.\<ref\>.supabase.co)는 IPv6 전용이라 GitHub 러너에서 실패 — 반드시 풀러.

## ⚠️ 실제로 겪은 함정 — 어기면 깨진다

| 함정 | 내용 | 위반 시 |
|---|---|---|
| **Vercel Git 재연결 금지** | 대시보드에서 GitHub 연동을 다시 켜지 말 것 | author 차단 부활 + 이중 배포 |
| **환경변수는 일반(encrypted) 타입** | "sensitive" 타입은 CI `vercel pull`이 값을 못 받음 | `NEXT_PUBLIC_*`가 undefined로 빌드 → **전 페이지 500** |
| **`vercel.json`의 `regions:["icn1"]` 유지** | 함수를 서울 고정 (DB와 리전 정렬) | 전 페이지 +1초 지연 |
| **60일 무커밋 시 schedule 정지** | GitHub가 예약 워크플로를 자동 비활성화 | 백업·keep-alive 중단 → 방학 중 DB 정지. Actions 탭에서 재활성화 |
| **pg_dump 버전 정렬** | 백업 워크플로는 PG17 클라이언트를 설치·PATH 선두 배치 | 러너 기본(16) ≠ 서버(17) → 즉시 실패 |
| **ISR 스모크 통과 필수** | 렌더링 변경 후 `bash scripts/isr-smoke.sh` 선검증 | 글 상세 프로덕션 500 (`rendering.md`) |
| **커밋 author** | (참고) CI 배포라 author 무관해졌지만, 소유 계정 권장 | — |

## 성능 메모

- 현재 워밍 TTFB ~0.2s, 콜드 스타트(유휴 후 첫 요청) ~1–3s는 Hobby 제약(UptimeRobot 워밍으로 빈도 완화).
- 콜드 스타트 자체 제거는 Vercel Pro($20)가 유일한 직접 해법 — 근거·대안 비교는
  `docs/research/performance_and_environments.md`.
- dev/prd 환경 분리는 현 구성에서 무비용 가능(Vercel preview 스코프 + Supabase Free 2호 프로젝트) — 같은 문서 참조.
