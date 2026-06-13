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
