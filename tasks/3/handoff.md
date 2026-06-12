# handoff: #3

## 변경 파일
- `.github/workflows/deploy.yml`: 최상위 `concurrency:` 블록과 `env:` 블록 사이에 `permissions:` 블록(`contents: read`, `pull-requests: write`) 3행 + 주변 빈 줄 1행을 추가. 레포 기본 토큰 권한이 read-only라 `gh pr comment` 스텝이 `Resource not accessible by integration` 에러로 실패하던 것을 수정.

## 핵심 결정
spec과 달라진 점 없음. spec의 구현 계획을 그대로 적용했다 — 삽입 위치, 들여쓰기(최상위 0), 권한 항목(정확히 두 개) 모두 spec 명세와 일치.

## 검증 방법
- diff 확인: `git diff main -- .github/workflows/deploy.yml` — 변경이 `permissions:` 블록 3행 + 빈 줄 1행뿐인지 확인 (다른 변경 없음, 본 세션에서 확인 완료)
- YAML 유효성: `python3 -c "import yaml; d=yaml.safe_load(open('.github/workflows/deploy.yml')); print(d['permissions'])"` → `{'contents': 'read', 'pull-requests': 'write'}` 출력 확인 완료 (PyYAML은 `python3 -m pip install --user pyyaml`로 설치했음)
- 실제 동작 검증은 다음 PR 이벤트의 deploy run에서 "PR에 preview URL 코멘트" 스텝 성공 여부로 자연 확인 (spec 범위 제외 항목대로 과거 실패 run 재실행은 하지 않음)

## 리뷰 포인트
- `contents: read`가 포함되어 `actions/checkout`이 계속 동작하는지 — 최상위 `permissions:` 선언 시 명시하지 않은 권한은 모두 none이 되므로 spec대로 함께 선언했다.
- 다른 워크플로(backup, keep-alive 등)는 spec 범위 제외라 건드리지 않았다.
