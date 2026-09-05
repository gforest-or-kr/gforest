---
description: 세션을 끝내며 Jira 이슈에 인수인계 코멘트 남기기 — 브랜치·한 것·남은 것·막힌 것. 사용법 /handover [GFM-n]
allowed-tools: Bash(git *) Bash(gh pr view *) mcp__atlassian-gforest__jira_add_comment mcp__atlassian-gforest__jira_get_issue
---
인자: `$ARGUMENTS` (비어 있으면 현재 브랜치명에서 GFM-n 추출)

!`git status --short --branch | head -10`
!`git log --oneline -8`

1. 이슈 키를 정한다(인자 → 브랜치명 순). 못 찾으면 묻는다.
2. push 되지 않은 커밋이 있으면 `git push -u origin <브랜치>` 한다(로컬에만 둔 작업은 인수인계가 아니다). 커밋되지 않은 변경은 커밋할지 묻는다.
3. 이 세션에서 실제로 한 일·남은 일·막힌 일·결정이 필요한 일을 사실대로 정리한다. 하지 않은 일을 한 것처럼 쓰지 않는다.
4. `jira_add_comment`로 아래 형식 그대로 남긴다:

```
[세션 인수인계 YYYY-MM-DD]
- 브랜치: <브랜치> (push 됨 / PR #n 또는 없음)
- 한 것: …
- 남은 것: …
- 막힌 것 / 결정 필요: …
- dev 확인: <했으면 무엇을, 아니면 "미확인">
```
5. 코멘트 링크를 보여주고 멈춘다. 이슈 상태는 바꾸지 않는다(/pr 이 바꾼다).
