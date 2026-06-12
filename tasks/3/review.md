verdict: pass

# review: #3

## Acceptance Criteria 판정
- [x] `permissions:` 블록이 최상위(들여쓰기 0)에 존재, 내용이 정확히 `contents: read` + `pull-requests: write` 두 항목 — `.github/workflows/deploy.yml:16-18` 직접 확인, `yaml.safe_load` 결과 `{'contents': 'read', 'pull-requests': 'write'}` (추가 권한 없음)
- [x] 블록 위치가 `concurrency:`(12–14행) 아래, `env:`(20행) 위 — spec의 삽입 후 구간 예시와 정확히 일치
- [x] 워크플로의 다른 부분은 diff에 없음 — `git diff origin/main...HEAD`에서 deploy.yml hunk는 `+permissions:` 3행 + 빈 줄 1행, 총 4행 추가뿐 (삭제·수정 0행)
- [x] deploy.yml 외 수정·생성 파일 없음 — diff 전체가 deploy.yml + `tasks/3/spec.md` + `tasks/3/handoff.md` (tasks/3 산출물은 허용 대상)
- [x] 유효한 YAML — `python3 -c "import yaml; ..."` 파싱 성공, 본 리뷰 세션에서 재실행하여 직접 확인

## 지적사항
없음.

## 비고
- `contents: read`가 함께 선언되어 있어 최상위 `permissions:` 추가로 인한 `actions/checkout` 권한 박탈(미명시 권한 → none) 문제 없음. handoff의 리뷰 포인트대로 확인 완료.
- 실제 효과(`gh pr comment` 스텝 성공)는 머지 후 다음 PR 이벤트의 deploy run에서 자연 검증된다 — spec 범위 제외 항목이라 과거 실패 run 재실행은 하지 않았으며, 승인 후 첫 PR preview run의 코멘트 스텝 성공 여부를 한 번 확인하면 폐루프가 닫힌다.
- 보안 측면: 부여 권한이 최소 범위(read + PR 댓글 쓰기)이고 `pull_request` 트리거(포크 PR에는 read-only 토큰)라 권한 확대 리스크 없음.
