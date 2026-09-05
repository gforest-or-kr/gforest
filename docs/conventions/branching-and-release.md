# 브랜치 · 릴리스(배포) 규약

> **모든 구성원이 반드시 따르는 규칙.** 원칙의 배경은 `CLAUDE.md`, 파이프라인 구조는 [cicd-and-ops.md](./cicd-and-ops.md).
> 한 줄 요약 — **`develop` = dev 환경, `main` = prod 환경.** 작업 브랜치 → `develop`(squash) → 릴리스 PR → `main`(merge commit) → prod 배포 + 날짜 태그 자동.

## 1. 왜 이 방식인가

- 팀이 이미 아는 `develop`/`main` 모델을 쓴다. 자원봉사 개발자가 주말에 잠깐 참여하는 팀에서는 **틀리지 않고 굴릴 수 있는 전략**이 가장 좋은 전략이다. (트렁크 기반 + 태그 방식은 2026-09-05 에 철회 — Confluence 05 운영 참조)
- 대신 "사람이 매번 기억해야 하는 절차"는 자동화·룰셋으로 없앴다: 릴리스 태그 자동, 역병합 PR 자동, 병합 방식은 룰셋이 강제, main 으로의 PR 출처는 CI 가 검사.
- 확인은 화면에서: `https://dev.gforest.or.kr/version`, `https://prod.gforest.or.kr/version`(컷오버 후 `https://gforest.or.kr/version`).

## 2. 브랜치

| 브랜치 | 역할 | 병합 규칙(룰셋) |
|---|---|---|
| `develop` | **기본 브랜치.** 통합 검증. push 즉시 **dev 자동 배포** | PR + `ci` 통과. **squash** (역병합 PR 만 merge commit). 직접 push·삭제·강제 push 금지 |
| `main` | prod 에 올라간 코드 그 자체. push 즉시 **prod 배포**(Owner 승인 후) + 태그 | PR + `ci`·`release-guard` 통과. **merge commit 만**. 출처는 `develop` 또는 `hotfix/*` 만 |
| 작업 브랜치 | 이슈 하나 = 브랜치 하나. `develop` 에서 딴다. 짧게(며칠) | `<type>/<GFM-키>-<slug>` 예: `feat/GFM-85-comment-reactions`, `fix/GFM-86-login-redirect`, `docs/GFM-87-runbook` |
| `hotfix/<GFM-키>-<slug>` | prod 긴급 수정. **`main` 에서** 딴다 | `main` 으로 PR → 배포 → 역병합 PR 이 자동으로 열린다(§5) |

- `type` = `feat` · `fix` · `infra` · `docs` · `chore` · `perf`. Jira 이슈가 없으면 **먼저 만든다**(CLAUDE.md 워크플로).
- 병합 후 작업 브랜치는 자동 삭제된다. 오래된 브랜치를 되살려 이어 쓰지 말고 `develop` 에서 새로 딴다.
- 여러 사람이 같은 이슈를 만지면 브랜치를 공유하지 말고 이슈를 쪼갠다. 두 사람의 Claude 가 같은 파일을 동시에 고치는 상황은 Jira 담당자 배정으로 막는다.
- **작게, 자주.** `develop` 에 며칠 이상 안 들어간 브랜치가 squash 충돌의 근원이다.

## 3. PR · 커밋

- PR 제목 = squash 커밋 제목: `type: 무엇을 (GFM-n)` — 예 `feat: 댓글 좋아요 (GFM-85)`. 한국어, 짧게.
- PR 본문: 무엇을/왜, 확인 방법(로컬에서 무엇을 봤나), 후속. Claude 가 만든 PR 은 세션 링크 트레일러를 포함한다.
- 올리기 전 **`npm run check`**(tsc·eslint·`next build`) 로컬 통과. 병합 조건: `ci` 초록 + 리뷰 스레드 해결. 승인 수는 현재 0(인원이 적음) — 팀이 커지면 1 로 올린다.
- 병합 후 **dev 에서 눈으로 확인**한다. `/version` 에서 자기 커밋이 배포됐는지 본다.

## 4. 릴리스 = `develop` → `main` PR

1. Owner(또는 릴리스 담당)가 `develop` 에서 `main` 으로 PR 을 연다. 제목 `release: YYYY-MM-DD 무엇무엇` — 본문에 포함 이슈 요약.
   ```sh
   gh pr create --base main --head develop --title "release: 2026-10-01 게시판 통폐합 1차" --fill
   ```
2. `ci` + `release-guard` 초록 확인 → **merge commit 으로 병합**(룰셋이 squash 를 막는다).
3. `main` push → `ecs-deploy(prod)` 가 시작되고 **GitHub environment `prod` 의 required reviewer(Owner)가 Actions 화면에서 승인**해야 실제 배포가 진행된다. 이것이 "prod 는 Owner 승인" 게이트다.
4. 배포·스모크가 끝나면 워크플로가 **태그 `vYYYY.MM.DD`** (같은 날 두 번째부터 `.2`, `.3` …)와 GitHub Release(포함 PR 목록 자동)를 만든다. 실패한 배포에는 태그가 남지 않는다.
5. `https://prod.gforest.or.kr/version` 에서 버전 확인. Discord 알림도 온다.

- 버전은 **날짜(CalVer)** 다. API 소비자가 없는 홈페이지라 `1.2.3` 식 의미 버전은 결정만 늘린다. dev 의 `/version` 은 `v2026.09.05-3-gabc1234`(마지막 릴리스 이후 3 커밋) 형태.
- 태그는 **삭제·이동하지 않는다**(룰셋). 잘못됐으면 다음 릴리스로 고친다.
- prod 인프라가 아직 없는 동안(repo 변수 `PROD_ENABLED` ≠ `true`) `main` push 는 배포를 건너뛴다. prod 생성 시 Owner 가 변수를 `true` 로 바꾼다.

## 5. 핫픽스 · 역병합 · 롤백

- **핫픽스**: `main` 에서 `hotfix/GFM-n-…` 을 따서 수정 → `main` 으로 PR(`release-guard` 가 허용) → 승인·배포·태그는 §4 와 같다.
  배포 후 `sync-develop` 워크플로가 **`main → develop` 역병합 PR 을 자동으로 연다** → 담당자가 확인하고 **merge commit** 으로 합친다(squash 하면 이력이 갈라진다).
  급하지 않으면 핫픽스도 그냥 `develop` 을 거쳐 릴리스하는 편이 단순하다.
- **롤백**: 이전 태그를 다시 배포한다 — Actions → `ecs-deploy` → "Run workflow" 에서 **ref 를 이전 태그**(`v2026.09.05`)로, environment=`prod`. 코드 되돌리기(revert PR)는 그 다음에 한다.
  ECS 서킷 브레이커는 새 버전이 헬스체크에 실패할 때만 자동 롤백하므로, "돌아가긴 하는데 잘못된" 배포는 사람이 이 절차로 되돌린다.
- DB 마이그레이션이 포함된 릴리스는 **롤백이 코드만으로 안 될 수 있다** — 마이그레이션은 하위 호환(컬럼 추가는 nullable, 삭제는 다음 릴리스에서)으로 쓴다.

## 6. 하지 말 것

| 금지 | 이유 |
|---|---|
| 릴리스·역병합 PR 을 squash | `main` 과 `develop` 이력이 갈라져 다음 릴리스마다 충돌. 룰셋이 main 에서는 막지만 develop 역병합은 사람이 지켜야 한다 |
| 작업 브랜치에서 바로 `main` 으로 PR | `release-guard` 가 막는다. 반드시 `develop` 을 거친다(핫픽스 제외) |
| `main`·`develop` 직접 push, 강제 push | 룰셋이 막는다. 우회하려 룰셋을 끄지 말 것 |
| 태그 삭제·재사용 | prod 이력이 거짓이 된다 |
| 큰 PR 을 오래 들고 있기 | dev 확인이 늦어지고 충돌이 커진다. 기능 플래그나 단계 분할로 작게 |
| 로컬에서 이미지 빌드·수동 배포 | 배포는 CI 만. 배포 이력(/version)에 남지 않는 배포는 없다 |

## 7. 관련 설정 (변경 시 이 문서도 갱신)

- 룰셋 `protect-develop`: PR 필수, `ci` 필수, 병합 방식 squash·merge, 삭제·강제 push 금지
- 룰셋 `protect-main`(`refs/heads/main` 명시 — 기본 브랜치 참조 아님): PR 필수, `ci`·`release-guard` 필수, 병합 방식 merge commit 만, 삭제·강제 push 금지
- 룰셋 `protect-release-tags`: `v*` 태그 갱신·삭제 금지(생성은 워크플로가 한다)
- 저장소 설정: 기본 브랜치 `develop`, 병합 방식 merge·squash 허용(룰셋이 브랜치별로 고른다), 병합 후 브랜치 자동 삭제
- GitHub environment `prod`: required reviewers = Owner. 변수 `PROD_ENABLED`(prod 배포 on/off), `PROD_SITE_URL`(컷오버 전 `https://prod.gforest.or.kr`)
- 워크플로: `ecs-deploy.yml`(develop→dev, main→prod+태그, dispatch=롤백) · `ci.yml`(`ci`, `release-guard`) · `sync-develop.yml`(역병합 PR)
