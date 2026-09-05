---
description: Jira 이슈로 작업 시작 — 진행 중 전환, develop 최신화, 작업 브랜치 생성, 이슈 맥락 로드. 사용법 /task GFM-85
allowed-tools: Bash(git *) Bash(gh *) Bash(docker compose ps *) mcp__atlassian-gforest__jira_get_issue mcp__atlassian-gforest__jira_transition_issue mcp__atlassian-gforest__jira_search
---
이슈 키: `$ARGUMENTS`

현재 브랜치·작업 트리:
!`git status --short --branch | head -8`

아래 순서대로 진행한다. 규칙은 docs/conventions/branching-and-release.md, claude-code.md.

1. 인자가 `GFM-숫자` 형식이 아니면 멈추고 이슈 키를 묻는다. 이슈가 없다고 하면 `jira_search`로 비슷한 제목을 찾아 보여주고, 없으면 만들지 말고 사용자에게 만들지 묻는다.
2. 작업 트리에 커밋되지 않은 변경이 있으면 **멈추고** 어떻게 할지 묻는다(stash·커밋·버림). 임의로 stash 하지 않는다.
3. `jira_get_issue`로 이슈를 읽는다. 상태가 `할 일`이면 `jira_transition_issue`(transition 21)로 `진행 중`으로 바꾼다. 이미 `진행 중`이면 그대로 둔다.
4. `git fetch origin` → `git checkout develop` → `git pull --ff-only`.
5. 브랜치 이름을 정한다: `<type>/<GFM-n>-<slug>`. `type`은 이슈 요약을 보고 `feat|fix|infra|docs|chore|perf` 중 하나, `slug`는 영문 소문자·하이픈 2~4단어. 같은 이슈의 브랜치가 원격에 이미 있으면(`git branch -r | grep GFM-n`) 새로 만들지 말고 그 브랜치를 checkout 한다. 없으면 `git checkout -b <이름>`.
6. 이슈 본문과 최근 코멘트(특히 `[세션 인수인계 …]`)를 3~6줄로 요약해 보여준다. "한 것 / 남은 것 / 결정 필요"가 있으면 그대로 옮긴다.
7. 로컬 환경 상태를 보여준다: `docker compose ps --format '{{.Name}} {{.Status}}'`. db·minio 가 없으면 `npm run db:up`을 권한다(실행은 사용자 확인 후).
8. 마지막 줄에 "다음: …" 한 문장으로 첫 작업을 제안하고 멈춘다. 코드 수정은 사용자가 시키기 전에 시작하지 않는다.
