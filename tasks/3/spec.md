# spec: deploy.yml에 permissions 블록 추가 — PR preview 댓글 권한 부족 수정 (#3)

## 요약

레포의 Actions 기본 토큰 권한이 read-only(`default_workflow_permissions: read`)인데
`.github/workflows/deploy.yml`에 `permissions:` 선언이 없어, PR preview 배포의 마지막
"PR에 preview URL 코멘트" 스텝(`gh pr comment`, `GH_TOKEN: ${{ github.token }}`)이
`GraphQL: Resource not accessible by integration (repository.pullRequest)` 에러로 실패하고
run 전체가 failure로 기록된다. 워크플로 최상위에 `contents: read` + `pull-requests: write`
권한 블록을 추가해 해결한다.

## 구현 계획

### 수정 파일: `.github/workflows/deploy.yml` (이 파일만 수정)

`concurrency:` 블록(12–14행)과 `env:` 블록(16–18행) 사이에 다음 블록을 최상위
(jobs와 같은 들여쓰기 레벨)로 삽입한다:

```yaml
permissions:
  contents: read
  pull-requests: write
```

삽입 후 해당 구간은 다음과 같아야 한다:

```yaml
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read
  pull-requests: write

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
```

- `contents: read`는 `actions/checkout`이 필요로 하는 권한이다. 최상위에 `permissions:`를
  선언하면 명시하지 않은 권한은 모두 `none`이 되므로 반드시 함께 포함한다.
- 그 외 트리거(`on:`), `concurrency:`, `env:`, `jobs:` 이하 스텝, 시크릿 사용은 일절
  변경하지 않는다. 주석도 추가·수정하지 않는다.

## Acceptance Criteria

- [ ] `.github/workflows/deploy.yml` 최상위(들여쓰기 0)에 `permissions:` 블록이 존재하고,
      내용이 정확히 `contents: read`와 `pull-requests: write` 두 항목이다 (추가 권한 없음)
- [ ] `permissions:` 블록이 `concurrency:` 블록 아래, `env:` 블록 위에 위치한다
- [ ] 이 워크플로의 다른 부분(이름, 트리거, concurrency, env, jobs 이하 전체)은 diff에
      나타나지 않는다 — 변경은 `permissions:` 블록 3행과 그 주변 빈 줄 추가뿐이다
- [ ] `.github/workflows/deploy.yml` 외의 파일은 수정·생성되지 않았다 (tasks/3/ 산출물 제외)
- [ ] 수정된 파일이 유효한 YAML이다 (예: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/deploy.yml'))"` 또는 `npx yaml-lint` 등으로 파싱 에러 없음 확인)

## 범위 제외

- 레포 설정의 `default_workflow_permissions` 변경 (read-only 기본값은 보안상 그대로 유지)
- 다른 워크플로 파일(`.github/workflows/` 내 backup, keep-alive 등)에 대한 동일 처리
- "PR에 preview URL 코멘트" 스텝의 로직 변경 (기존 코멘트 업데이트 방식 전환, sticky comment 등)
- 실패한 과거 run(27426317259, 27426228258)의 재실행 — 다음 PR 이벤트에서 자연 검증
