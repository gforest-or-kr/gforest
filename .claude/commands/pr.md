---
description: 현재 브랜치를 PR로 — npm run check, 커밋(트레일러), push, develop 대상 PR, Jira 인수인계 코멘트·검토 중 전환
allowed-tools: Bash(npm run check) Bash(git *) Bash(gh pr *) Bash(gh auth status) mcp__atlassian-gforest__jira_add_comment mcp__atlassian-gforest__jira_transition_issue mcp__atlassian-gforest__jira_get_issue
---
브랜치·변경 요약:
!`git status --short --branch | head -20`
!`git log --oneline origin/develop..HEAD 2>/dev/null | head -20`

규칙: docs/conventions/branching-and-release.md §3. 아래 순서대로.

1. 브랜치가 `develop`/`main`이면 **멈춘다**(직접 push 금지). 브랜치명에서 이슈 키 `GFM-n`을 뽑는다. 없으면 묻는다.
2. `npm run check`를 실행한다. 실패하면 고치지 말고 결과를 보여주고 멈춘다(사용자가 고칠지 시킬지 정한다).
3. 커밋되지 않은 변경이 있으면 `git add -A` 후 커밋한다. 메시지: 첫 줄 `type: 무엇을 (GFM-n)`(한국어, 50자 내), 본문에 왜·확인 방법, 마지막에 트레일러
   `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` 와 `Claude-Session: <이 세션 링크>`.
4. `git push -u origin <브랜치>`.
5. 이미 열린 PR이 있으면(`gh pr view --json url`) 새로 만들지 않고 URL만 보여준다. 없으면 `gh pr create --base develop` — **제목 = squash 커밋 제목**(`type: 무엇을 (GFM-n)`), 본문은 `## 무엇을 / 왜`, `## 확인`(로컬에서 본 것), `## 후속`, `Jira: GFM-n`, 그리고 `🤖 Generated with [Claude Code](https://claude.com/claude-code)` + 세션 링크.
6. Jira 이슈에 인수인계 코멘트를 남긴다(claude-code.md §5 템플릿: 브랜치/PR, 한 것, 남은 것, 막힌 것). 상태를 `검토 중`(transition 31)으로 바꾼다.
7. PR URL과 "병합은 사람이 squash로, 병합 후 dev `/version`에서 확인"을 한 줄로 안내하고 멈춘다. **병합하지 않는다.**
