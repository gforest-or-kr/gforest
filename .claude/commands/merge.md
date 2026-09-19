---
description: (core·Owner) develop 대상 PR 을 squash 병합 — ci 초록 확인 → gh pr merge --admin → develop 최신화 → Jira 완료. 사용법 /merge [PR번호]
allowed-tools: Bash(git *) Bash(gh pr view *) Bash(gh pr checks *) mcp__atlassian-gforest__jira_transition_issue mcp__atlassian-gforest__jira_get_issue
---
인자: `$ARGUMENTS` (비어 있으면 현재 브랜치의 PR)

!`gh pr view $ARGUMENTS --json number,title,baseRefName,headRefName,mergeStateStatus,url --jq '"#\(.number) \(.title)\nbase=\(.baseRefName) head=\(.headRefName) state=\(.mergeStateStatus)\n\(.url)"' 2>&1`
!`gh pr checks $ARGUMENTS 2>&1 | head -6`

규칙: docs/conventions/branching-and-release.md §3·§7. 이 명령은 **core 팀·Owner** 만 성공한다(룰셋 `restrict-develop-merge` 의 bypass). contributors 가 실행하면 서버가 거부한다 — core 에게 병합을 요청한다.

1. PR 을 못 찾으면(인자 없음 + 현재 브랜치에 PR 없음) 번호를 묻고 멈춘다. base 가 `develop` 이 아니면 **멈춘다**. `main` 대상(릴리스·핫픽스)은 merge commit 이 필요하고 사람이 웹에서 승인·병합한다(`/release`).
2. 위 checks 에 `fail`·`pending` 이 있으면 멈춘다. `ci` 가 `pass` 여야 한다(`release-guard` 는 develop 대상에서 `skipping` 이 정상). `state=BLOCKED` 는 룰셋 때문에 **항상** 그렇게 보이므로 그것만으로는 멈추지 않는다.
3. 제목이 `type: 무엇을 (GFM-n)` 형식인지 본다. 아니면 멈추고 고칠지 묻는다(squash 커밋 제목이 된다).
4. `gh pr merge <n> --squash --delete-branch --admin` 을 실행한다. **이때 권한 확인창이 뜨는 것이 의도**다(`gh pr merge` 는 허용 목록에 넣지 않는다 — 사람의 최종 확인). `--admin` 은 gh 가 BLOCKED 를 클라이언트에서 거르지 않게 하는 플래그일 뿐이고, 허용 여부는 서버가 bypass 권한으로 판단한다. 거부되면(권한 없음·체크 미통과) 메시지를 그대로 보여주고 멈춘다. 다른 플래그·강제 수단을 시도하지 않는다.
5. `git checkout develop && git pull --ff-only`.
6. 브랜치명·제목에서 이슈 키 `GFM-n` 을 뽑아 `jira_transition_issue`(transition 41, `완료`). 키가 없으면 건너뛰고 알린다.
7. "dev 배포가 자동으로 시작됨 — 몇 분 뒤 https://dev.gforest.or.kr/version 에서 확인, Discord #deploy 알림" 한 줄로 안내하고 멈춘다.
