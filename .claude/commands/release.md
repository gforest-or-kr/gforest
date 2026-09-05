---
description: (Owner) develop → main 릴리스 PR 열기 — 마지막 릴리스 이후 포함 PR 목록으로 본문 작성. 병합·승인은 사람이
allowed-tools: Bash(git *) Bash(gh pr *) Bash(gh release *) Bash(gh api repos/gforest-or-kr/gforest/*)
---
규칙: docs/conventions/branching-and-release.md §4. 릴리스 PR은 **merge commit**으로 합치고, main push 후 environment `prod` 승인이 있어야 배포된다.

!`git fetch origin --tags -q && git log --oneline origin/main..origin/develop | head -40`
!`git describe --tags --abbrev=0 origin/main 2>/dev/null || echo "(태그 없음)"`

1. 위 목록이 비어 있으면 "릴리스할 변경 없음"으로 멈춘다.
2. 이미 열린 `develop → main` PR이 있으면(`gh pr list --base main --head develop`) URL만 보여주고 멈춘다.
3. 목록에서 PR 번호·이슈 키를 뽑아 본문을 만든다: `## 포함`(한 줄에 하나, `- feat: … (GFM-n) #m`), `## DB 마이그레이션`(db/migrations 변경 여부와 파일명, 없으면 "없음"), `## 배포 후 확인`(prod `/version`, 영향받는 화면).
4. `gh pr create --base main --head develop --title "release: YYYY-MM-DD <한 줄 요약>" --body ...`.
5. 안내하고 멈춘다: "ci·release-guard 초록 확인 → merge commit 병합 → Actions에서 prod 배포 승인 → 태그 자동 생성 → prod `/version` 확인". **병합·승인은 하지 않는다.**
