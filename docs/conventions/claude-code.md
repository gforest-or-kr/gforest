# Claude Code 협업 가이드 — 여러 사람·여러 머신에서 같은 맥락으로 일하기

> 대상: Claude Code(또는 다른 AI 코딩 도구)로 이 repo를 만지는 모든 구성원. 목적은 **"누가 어느 머신에서 세션을 열어도 같은 규칙·같은 맥락·같은 도구"**가 되게 하는 것.

## 1. 문서 체계 — 무엇이 어디에 있나

| 층 | 파일 | 성격 | 누가 바꾸나 |
|---|---|---|---|
| **헌법** | `CLAUDE.md` (루트) | 원칙과 절대 규칙. Claude 세션에 **자동 로드**. 짧게, 바뀌지 않게 | 팀 합의로만 (PR 리뷰 필수) |
| **규약(how-to)** | `docs/conventions/*.md` | 브랜치·릴리스, CI/CD·운영, 코드 패턴, Jira·Confluence 작성, 이 문서 | 담당자가 PR로. README 목차 갱신 |
| **설계·근거** | `docs/design/*`, `docs/research/*`, `docs/plans/*` | 왜 이렇게 결정했나. 낡으면 "역사적 문서" 배너 | 결정이 바뀔 때 |
| **코드 곁 문서** | `infra/*/README.md`, 파일 상단 주석 | 그 폴더를 열었을 때 바로 필요한 실행법 | 코드와 함께 |
| **팀 전용** | Confluence 05 운영 | 계정·접근 정보, 사람이 읽는 설명서. repo 문서의 미러 | Confluence에서 |

규칙: **원칙은 CLAUDE.md에, 절차는 conventions에, 이유는 design/research에.** 같은 내용을 두 곳에 쓰지 말고 링크한다. CLAUDE.md가 길어지면 헌법이 아니라 매뉴얼이 된다.

## 2. 세션을 열었을 때 (사람도 Claude도 동일)

1. **`/task GFM-n`** — develop 최신화 + 브랜치 + 이슈 `진행 중` + 맥락 로드를 한 번에(§2-1). 수동으로 하면: `git pull` 후 `<type>/<GFM-키>-<slug>` 브랜치 ([branching-and-release.md](./branching-and-release.md)).
2. Jira 이슈가 없으면 먼저 만든다. **세션 간 맥락 인수인계의 단일 진실은 Jira 이슈 코멘트 + PR 본문**이다 — 개인 메모리·채팅 기록은 머신을 넘어가지 않는다.
3. 로컬 인프라: `npm run db:up`(Docker Compose Postgres·MinIO). `gh auth status`. AWS 는 인프라 담당만(`aws sso login --profile gforest --use-device-code`).
4. **`/pr`** — `npm run check` 통과 → 커밋 → push → PR → Jira 인수인계까지. CI 는 필요조건이지 로컬 검증의 대체가 아니다.
5. 끝낼 때 PR 을 못 올렸으면 **`/handover`** — push + Jira 에 "어디까지 했고 다음은 무엇". 미완성 브랜치는 push해 둔다(로컬에만 두지 않는다).

### 2-1. 공용 명령 (`.claude/commands/`, repo 에 포함 — 모든 머신에서 동일)

| 명령 | 하는 일 | 하지 않는 일 |
|---|---|---|
| `/task GFM-n` | 이슈 `진행 중` 전환 → develop 최신화 → `<type>/GFM-n-<slug>` 브랜치 → 이슈·인수인계 코멘트 요약 → 로컬 환경 확인 | 코드 수정 시작, stash |
| `/pr` | `npm run check` → 커밋(트레일러) → push → **develop 대상 PR**(제목 규약) → Jira 인수인계 코멘트 + `검토 중` | 병합, check 실패 시 자동 수정 |
| `/handover [GFM-n]` | 세션 끝: push 확인 + Jira 인수인계 코멘트(§5 템플릿) | 이슈 상태 변경 |
| `/release` | (Owner) `develop → main` 릴리스 PR, 포함 PR 목록·마이그레이션 여부 본문 | 병합, prod 승인 |

명령은 절차를 고정할 뿐 판단을 대신하지 않는다 — 멈추고 묻는 지점(미커밋 변경, check 실패, 이슈 없음)이 의도된 것이다. 절차를 바꾸려면 명령 파일을 PR 로 고친다(규약 문서와 함께).

## 3. 머신마다 맞춰야 하는 것 (1회)

| 항목 | 방법 | 비고 |
|---|---|---|
| repo | `git clone git@github.com:gforest-or-kr/gforest.git` | 개인 GitHub 계정 + 2FA, Org 멤버 |
| Node 22, **Docker Desktop**, `gh` | brew / Docker 공식 설치 | 로컬 DB·미디어는 `npm run db:up`(Postgres 17 + MinIO). `psql` 불필요 |
| `.env.local` | `.env.local.example` 복사 — 기본값이 로컬 compose 기준 | dev RDS 에는 개발자가 직접 붙지 않는다(비공개). 마이그레이션은 배포 파이프라인이 |
| AWS (**인프라 담당만**) | `aws` CLI v2, Terraform ≥1.10, `~/.aws/config`에 `gforest` SSO 프로필 (`infra/shared/README.md`) | Identity Center 사용자는 Owner가 만들어 준다. 일반 개발자는 AWS 계정이 없다 |
| `.env` | `ATLASSIAN_EMAIL`, `ATLASSIAN_API_TOKEN`(본인 계정 토큰) | Jira/Confluence MCP·스크립트 공용 |
| Claude Code MCP | repo의 `.mcp.json`이 `atlassian-gforest` 서버를 정의(`.env`를 읽음). `uv` 설치 필요 | 회사 Atlassian 등 **다른 MCP는 이 프로젝트에서 쓰지 않는다** |
| Claude Code 권한 | repo의 `.claude/settings.json`(공유 허용 목록 — 공용 명령이 쓰는 git/gh/npm 포함). 개인 추가는 `.claude/settings.local.json`(gitignore) | 위험 명령(rm -rf, terraform apply/destroy, git push --force, gh pr merge)은 허용 목록에 넣지 않는다 — 매번 확인창이 뜨는 것이 의도 |

## 4. Claude Code를 쓸 때의 규칙

- **CLAUDE.md는 명령이다.** 세션이 원칙과 충돌하는 제안을 하면 원칙이 이긴다. 원칙을 바꾸고 싶으면 PR로.
- **개인 메모리에 팀 사실을 두지 않는다.** Claude의 자동 메모리(`~/.claude/projects/...`)는 그 머신·그 사람에게만 있다. 다른 사람이 알아야 할 사실(결정, 함정, 절차)은 반드시 `docs/conventions` 또는 Confluence로 옮긴다. 개인 취향(에디터, 말투)은 `CLAUDE.local.md`(gitignore)에.
- **비밀값은 채팅에 붙여넣지 않는다.** 붙여넣어야 했다면 그 키는 오염된 것으로 보고 로테이션한다. 값은 SSM/Bitwarden/`.env`에서 도구가 읽게 한다.
- **커밋 트레일러**: Claude가 만든 커밋·PR에는 `Co-Authored-By`와 세션 링크가 붙는다. 지우지 않는다 — 나중에 "왜 이렇게 했지"를 세션에서 추적한다.
- **한 이슈 = 한 브랜치 = 한 세션 흐름.** 다른 이슈로 넘어가면 브랜치를 바꾼다. 병렬 작업은 `git worktree`(`EnterWorktree`)로 폴더를 분리한다.
- **AI가 만든 변경도 사람이 dev에서 눈으로 확인**하고 나서 릴리스 PR(develop → main)을 연다. `ci` 초록은 필요조건이지 충분조건이 아니다.
- **인프라 apply는 사람이 로컬에서.** Claude에게 `terraform apply`를 시킬 수 있지만 plan을 먼저 보고 승인한다. 콘솔 클릭으로 만든 리소스는 존재하지 않는 것으로 취급한다(Terraform 밖).

## 5. 세션 간 인수인계 템플릿 (Jira 코멘트)

```
[세션 인수인계 YYYY-MM-DD]
- 브랜치: feat/GFM-75-… (push 됨 / PR #n)
- 한 것: …
- 남은 것: …
- 막힌 것 / 결정 필요: …
- dev 확인: /version 리비전 n, 화면 X 정상
```

## 6. 자주 겪는 문제

| 증상 | 원인·해결 |
|---|---|
| Claude가 현행 스택과 다른 방식(매니지드 BaaS SDK·서버리스 증분 정적 재생성 등)으로 코드를 짠다 | 오래된 기억이나 외부 예제를 따라간 것. CLAUDE.md §스택·§기술 원칙 9와 `docs/conventions/code-patterns.md`를 다시 읽게 한다 |
| Confluence 쓰기가 "cloud id not granted" | 회사 Atlassian MCP를 탔다. gforest 사이트는 `atlassian-gforest` 서버(`.mcp.json`)만 |
| `gh` 401 / AWS "Token has expired" | 각각 `gh auth login -h github.com`, `aws sso login --profile gforest --use-device-code` |
| 빌드는 되는데 CI `ci`가 실패 | CI는 DB 없이 `next build`한다. 빌드 시점 DB 접근(`generateStaticParams`, 정적 라우트)이 들어갔는지 확인 |
| 두 머신에서 같은 브랜치를 수정 | 하지 않는다. 한쪽에서 push → 다른 쪽 pull. 충돌 시 새 브랜치로 |
