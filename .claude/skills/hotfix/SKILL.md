---
name: hotfix
description: prod 에 당장 고쳐야 할 문제가 있고 develop 에는 아직 내보내면 안 되는 변경이 섞여 있을 때. main 에서 hotfix/ 브랜치 → main PR(merge commit) → 배포 → 역병합 PR.
---
# 핫픽스

**급하지 않으면 그냥 develop 을 거친다(더 단순하다).** 규칙: `docs/conventions/branching-and-release.md` §5.

## 순서
1. `git fetch && git checkout -b hotfix/GFM-n-<slug> origin/main` (develop 이 아니라 **main** 에서 딴다).
2. 수정 → 로컬 검증 → `npm run check` → PR **base=main** (`release-guard` 가 `hotfix/*` 를 허용한다). `/pr` 은 develop 대상이므로 여기서는 `gh pr create --base main` 을 직접 쓴다. 제목은 `fix: … (GFM-n)`.
3. `ci`·`release-guard` 초록 → **merge commit** 으로 병합(룰셋이 squash 를 막는다) → Actions `ecs-deploy` 에서 Owner 가 environment `prod` 배포 승인 → 태그 `vYYYY.MM.DD(.N)` 자동.
4. 배포 후 `sync-develop` 워크플로가 `main → develop` 역병합 PR 을 연다 → 확인하고 **merge commit** 으로 합친다(squash 하면 이력이 갈라진다).
5. Jira 이슈에 "핫픽스로 나감" 을 남기고 `완료`.

## 롤백이 필요하면
Actions → `ecs-deploy` → Run workflow, ref=이전 태그, environment=prod. 마이그레이션이 포함된 배포는 코드 롤백만으로 안 될 수 있다.
