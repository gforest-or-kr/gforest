# 브랜치 · 릴리스(배포) 규약

> **모든 구성원이 반드시 따르는 규칙.** 원칙의 배경은 `CLAUDE.md`, 파이프라인 구조는 [cicd-and-ops.md](./cicd-and-ops.md).
> 한 줄 요약 — **main 하나 = dev 환경, 태그 `vX.Y.Z` = prod 배포.** 장기 브랜치는 main뿐이다.

## 1. 왜 이 방식인가

- 전담 인력이 없고 담당자가 바뀌는 조직이라 **규칙이 적어야 지켜진다.** `develop`/`main` 두 장기 브랜치는 릴리스 PR·핫픽스 역병합·squash 충돌(§6) 같은 "사람이 매번 기억해야 하는 절차"를 만든다.
- main 하나로 두고 **"prod에 무엇이 올라갔는가"는 태그와 GitHub Releases가 답한다.** 브랜치가 아니라 태그가 릴리스 단위다.
- 확인은 화면에서: `https://dev.gforest.or.kr/version`, `https://gforest.or.kr/version`.

## 2. 브랜치

| 브랜치 | 역할 | 규칙 |
|---|---|---|
| `main` | 유일한 장기 브랜치. 병합 즉시 **dev 자동 배포** | 직접 push 금지(룰셋). PR + `ci` 통과 + **squash 병합**만 |
| 작업 브랜치 | 이슈 하나 = 브랜치 하나. 짧게(며칠) 유지 | `<type>/<GFM-키>-<slug>` 예: `feat/GFM-75-comment-reactions`, `infra/GFM-80-cloudfront`, `fix/GFM-81-login-redirect`, `docs/GFM-82-runbook` |

- `type` = `feat` · `fix` · `infra` · `docs` · `chore` · `perf`. Jira 이슈가 없으면 **먼저 만든다**(CLAUDE.md 워크플로).
- 병합 후 브랜치는 자동 삭제된다. 오래된 브랜치를 되살려 이어 쓰지 말고 main에서 새로 딴다.
- 여러 사람이 같은 이슈를 만지면 브랜치를 공유하지 말고 이슈를 쪼갠다.

## 3. PR · 커밋

- PR 제목 = squash 커밋 제목: `type: 무엇을 (GFM-n)` — 예 `feat: 댓글 좋아요 (GFM-75)`. 한국어, 명령형·명사형 어느 쪽이든 짧게.
- PR 본문: 무엇을/왜, 확인 방법(dev에서 어디를 봤나), 후속. Claude가 만든 PR은 세션 링크 트레일러를 포함한다.
- 병합 조건: `ci`(tsc·eslint·`next build`) 초록 + 리뷰 스레드 해결. 리뷰어 승인 수는 현재 0(인원이 적음) — 팀이 커지면 1로 올린다.
- 병합 후 **dev에서 눈으로 확인**한다. `/version`에서 자기 커밋이 배포됐는지 본다.

## 4. 릴리스 = 태그 (prod 배포)

- 버전은 **`vMAJOR.MINOR.PATCH`** (시맨틱 버전). 태그는 **main의 커밋**에만 찍는다.
  - `MAJOR` — 사용자 눈에 보이는 큰 전환(예: 컷오버 `v1.0.0`, 인증 방식 변경)
  - `MINOR` — 기능 추가·게시판 구조 변경
  - `PATCH` — 버그 수정·문구·성능
- 태그 생성 = prod 배포 트리거(`ecs-deploy.yml`의 `push: tags: v*`). **태그를 만들 수 있는 사람은 repo admin(Owner)뿐**(태그 룰셋). 일반 멤버는 "릴리스 요청"을 Jira/PR 코멘트로 한다.
- 절차 (Owner):
  ```sh
  git checkout main && git pull
  gh release create v1.2.0 --generate-notes --title "v1.2.0"   # 태그 생성 + 릴리스 노트(포함 PR 목록) 자동
  # → Actions에서 ecs-deploy(prod) 진행 확인 → https://gforest.or.kr/version 에서 버전 확인
  ```
  특정 커밋에 찍어야 하면 `gh release create v1.2.0 --target <sha> --generate-notes`.
- 태그는 **삭제·이동하지 않는다.** 잘못 찍었으면 다음 번호로 다시 찍는다.
- 컷오버 전(현 홈페이지가 cafe24에서 운영 중인 동안)에는 prod 태스크가 없으므로 태그를 찍지 않는다. 컷오버 시점의 첫 태그가 `v1.0.0`.

## 5. 핫픽스 · 롤백

- **핫픽스(일반)**: main에 `fix/…` PR → dev 확인 → `PATCH` 태그. main에 아직 prod에 내보내면 안 되는 변경이 섞여 있지 않은 것이 전제다(작은 PR을 자주 병합하는 습관이 이 전제를 지켜준다).
- **핫픽스(예외, main을 내보낼 수 없을 때)**: 마지막 prod 태그에서 `hotfix/GFM-n-…` 브랜치를 따 수정 → 그 브랜치 커밋에 `PATCH` 태그(예외적으로 main 밖의 태그) → 같은 수정을 main에도 PR로 병합. 예외를 썼다는 사실을 Jira 이슈에 남긴다.
- **롤백**: 이전 태그를 다시 배포한다 — Actions → ecs-deploy → "Run workflow"에서 **ref를 이전 태그**로, environment=prod. 코드 되돌리기(revert PR)는 그 다음에 한다. ECS 서킷 브레이커는 새 버전이 헬스체크에 실패할 때만 자동 롤백하므로, "돌아가긴 하는데 잘못된" 배포는 사람이 이 절차로 되돌린다.
- DB 마이그레이션이 포함된 릴리스는 **롤백이 코드만으로 안 될 수 있다** — 마이그레이션은 되도록 하위 호환(컬럼 추가는 nullable, 삭제는 다음 릴리스에서)으로 쓴다.

## 6. 하지 말 것

| 금지 | 이유 |
|---|---|
| `develop` 같은 두 번째 장기 브랜치 | squash 병합과 충돌해 릴리스 PR마다 conflict가 난다. 두 브랜치 이력이 갈라진다 |
| main 직접 push, 강제 push | 룰셋이 막는다. 우회하려 룰셋을 끄지 말 것 |
| 태그 삭제·재사용 | prod 이력이 거짓이 된다 |
| 큰 PR을 오래 들고 있기 | dev 확인이 늦어지고 핫픽스 전제(§5)가 깨진다. 기능 플래그나 단계 분할로 작게 |
| 로컬에서 이미지 빌드·수동 배포 | 배포는 CI만. 배포 이력(/version)에 남지 않는 배포는 없다 |

## 7. 관련 설정 (변경 시 이 문서도 갱신)

- main 룰셋 `protect-main`: PR 필수, `ci` 필수, squash만, 삭제·강제 push 금지 (GitHub → Settings → Rules)
- 태그 룰셋 `protect-release-tags`: `v*` 태그 생성·갱신·삭제는 admin만
- `.github/workflows/ecs-deploy.yml`: `push: branches: [main]` → dev, `push: tags: [v*]` → prod, `workflow_dispatch` → 수동/롤백
- GitHub environment `prod`: 필요 시 required reviewers 추가
