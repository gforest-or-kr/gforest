# 협업 개발자 온보딩 가이드

> 새 개발자가 **계정 준비 → 도구 설치 → 로컬 환경 → 첫 PR** 까지 혼자 따라갈 수 있게 쓴 문서. 반나절이면 끝난다.
> 모든 도구는 **무료 라이선스** 기준이다. 막히면 §9 문제 해결 → 그래도 안 되면 Discord `#dev`.
> 원칙은 `CLAUDE.md`, 작업 방법은 [playbooks.md](./playbooks.md), 나머지 규약은 [README](./README.md).

## 0. 한눈에

- 개발은 **각자 로컬**에서 한다. Docker 로 Postgres·MinIO(S3 흉내)를 띄우고 Next.js 를 돌린다. **AWS 계정은 필요 없다.**
- 코드는 `develop` 에서 딴 브랜치에서 작업 → PR → CI 통과 → 병합되면 **dev(`https://dev.gforest.or.kr`)에 자동 배포**된다. prod 배포는 Owner 가 한다.
- Claude Code 로 작업하면 `/task GFM-n`(시작) → `/pr`(마무리) 두 명령이 절차를 대신 지켜 준다.

필요한 계정: GitHub(2FA), Atlassian(Jira·Confluence, 초대받음), Claude(Pro 이상 — Claude Code 사용 시), Discord.

## 1. 계정 준비 (설치 전에)

| 계정 | 할 일 | 비고 |
|---|---|---|
| GitHub | 개인 계정 + **2FA 필수**. 사용자명을 Owner 에게 알려 조직 `gforest-or-kr` 초대를 받고 수락 | 조직은 2FA 없는 멤버를 허용하지 않는다 |
| Atlassian | Owner 의 초대 메일로 `gforest.atlassian.net` 가입. 이후 **API 토큰** 발급: https://id.atlassian.com/manage-profile/security/api-tokens → "Create API token" → 이름 `gforest-claude` → 값 복사 | 토큰은 한 번만 보인다. `.env` 에 넣을 것(§5) |
| Claude | claude.ai 가입 후 Pro 이상 구독(개인 결제). Claude Code 는 구독 계정으로 로그인 | 구독 없이도 개발은 가능하다 — Claude Code 절은 건너뛰면 됨 |
| Discord | 서버 초대 링크로 참여. 배포 알림이 `#deploy` 에 온다 | |

## 2. 설치 — macOS

터미널을 열고 순서대로. 이미 있는 것은 건너뛴다.

```sh
# 1) Homebrew (패키지 관리자)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2) Git · GitHub CLI · Node 22 · uv(Python 실행기, Atlassian MCP 용)
brew install git gh node@22 uv
brew link --overwrite node@22
node -v        # v22.x

# 3) Docker Desktop (Postgres·MinIO 컨테이너)
brew install --cask docker
open -a Docker  # 첫 실행 — 메뉴바 고래 아이콘이 멈출 때까지 기다린다

# 4) 에디터 (선택: VS Code) · DB 클라이언트 (DBeaver Community — 무료, 제한 없음)
brew install --cask visual-studio-code dbeaver-community

# 5) Claude Code (선택)
curl -fsSL https://claude.ai/install.sh | bash
claude --version
```

- Docker Desktop 라이선스: 개인·교육·비영리·소규모 조직(직원 250명 미만, 매출 1천만 달러 미만)은 무료. 우리 조합은 해당된다. 회사 노트북이라 회사 정책상 쓸 수 없으면 **Rancher Desktop**(무료, `dockerd` 모드 선택)으로 대체 가능 — `docker compose` 명령이 그대로 돈다.
- Apple Silicon/Intel 모두 동일. 사내 프록시가 있으면 Docker Desktop 설정 → Resources → Proxies 에 넣는다.

## 3. 설치 — Windows

**WSL2(Ubuntu) 안에서 작업한다.** 저장소의 스크립트가 bash 이고, Docker 도 WSL2 위에서 돈다. Windows 쪽에는 Docker Desktop 과 VS Code 만 설치한다.

```powershell
# PowerShell (관리자) — 1) WSL2 + Ubuntu
wsl --install -d Ubuntu
# 재부팅 후 Ubuntu 창이 뜨면 리눅스 사용자명·비밀번호 설정

# 2) Docker Desktop, VS Code, DBeaver (winget — Windows 10/11 기본 포함)
winget install -e --id Docker.DockerDesktop
winget install -e --id Microsoft.VisualStudioCode
winget install -e --id dbeaver.dbeaver
```

Docker Desktop 실행 → Settings → **General: "Use the WSL 2 based engine"** 켬 → **Resources → WSL integration: Ubuntu 켬** → Apply.

이제 **Ubuntu 터미널**(시작 메뉴의 Ubuntu, 또는 Windows Terminal)에서:

```sh
# 3) 기본 도구
sudo apt update && sudo apt install -y git curl unzip build-essential

# 4) GitHub CLI
(type -p wget >/dev/null || sudo apt install -y wget) && sudo mkdir -p -m 755 /etc/apt/keyrings \
 && wget -qO- https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo tee /etc/apt/keyrings/githubcli-archive-keyring.gpg >/dev/null \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list >/dev/null \
 && sudo apt update && sudo apt install -y gh

# 5) Node 22 (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22 && nvm use 22 && node -v

# 6) uv (Atlassian MCP 용)
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# 7) Docker 가 WSL 에서 보이는지
docker --version && docker compose version

# 8) Claude Code (선택)
curl -fsSL https://claude.ai/install.sh | bash
```

- **저장소는 반드시 WSL 파일시스템(`~/dev/…`)에 클론한다.** `/mnt/c/…`(Windows 드라이브)에 두면 파일 감시·빌드가 수 배 느리고 권한 문제가 난다.
- VS Code 는 Windows 에 설치하고 **"WSL" 확장**을 넣은 뒤, Ubuntu 터미널에서 `code .` 로 연다(자동으로 WSL 모드).
- 줄바꿈: 저장소의 `.gitattributes` 가 `.sh` 를 LF 로 고정하므로 따로 설정할 것 없다. 만약 `bash: /bin/bash^M` 오류가 나면 `git config --global core.autocrlf false` 후 다시 클론.

## 4. 저장소 받기

```sh
gh auth login          # GitHub.com → HTTPS → 브라우저 로그인 (2FA)
gh auth setup-git      # git push 에 gh 자격증명 사용
mkdir -p ~/dev && cd ~/dev
gh repo clone gforest-or-kr/gforest && cd gforest
git config user.name "이름" && git config user.email "GitHub 이메일"
npm ci                 # 의존성 설치 (1~2분)
```

기본 브랜치는 `develop` 이다. `main` 은 prod 와 같으며 직접 손대지 않는다.

## 5. 환경 파일 두 개

```sh
cp .env.local.example .env.local   # 앱 설정 — 기본값이 로컬 Docker 기준이라 그대로 쓴다
cat > .env <<'EOF'                 # Atlassian (Jira·Confluence) — Claude Code MCP·스크립트가 읽는다
ATLASSIAN_EMAIL=본인 Atlassian 이메일
ATLASSIAN_API_TOKEN=§1 에서 만든 토큰
EOF
```

둘 다 gitignore 되어 있다. **커밋되지 않는지 `git status` 로 한 번 확인**하고, 채팅·이슈에 토큰을 붙여넣지 않는다(붙여넣었으면 토큰을 폐기하고 다시 만든다).

## 6. 로컬 환경 띄우기

```sh
npm run db:up      # Postgres 17 + MinIO 컨테이너 기동 → 스키마·시드·테스트 계정 적용 (첫 실행은 이미지 받느라 몇 분)
npm run dev        # http://localhost:3000
```

| 확인 | 기대 |
|---|---|
| `docker compose ps` | `gforest-db-1`, `gforest-minio-1` 가 `healthy` |
| http://localhost:3000 | 메인 화면. 공개 게시판(알려드립니다 등)에 샘플 글 |
| 로그인 | `member.test@gforest.kr` / `DevTest!2026` → 회원 게시판(자유게시판) 글이 보임 |
| 다른 계정 | `admin.test@`(관리자), `operator.test@`(운영위원), `pending.test@`(승인 대기) — 비밀번호 동일 |
| http://localhost:9001 | MinIO 콘솔 (minioadmin / minioadmin), 버킷 `gforest-media-local` |

### 6-1. DB 를 GUI 로 보기 — DBeaver

스키마·데이터는 로컬 DB 에서 본다(dev/prod RDS 는 개발자가 직접 붙지 않는다). DBeaver Community 는 Apache 라이선스라 조건 없이 무료다. Windows 는 WSL 이 아니라 **Windows 쪽에 설치**하고 `localhost` 로 붙으면 된다(Docker Desktop 이 포트를 Windows 에 노출한다).

1. DBeaver 실행 → `Database` → `New Database Connection` → **PostgreSQL** → Next. (처음이면 드라이버 다운로드 확인창이 뜬다 → Download)
2. 접속 정보 — Host `localhost`, Port `5432`, Database `gforest`, Username `gforest_admin`, Password `gforest`. "Save password" 체크 → `Test Connection` → Finish.
3. 왼쪽 트리에서 `gforest` → `Schemas` → `public` → `Tables` 로 테이블·컬럼·인덱스, `auth` 스키마에 사용자 테이블. 테이블 우클릭 → `View Data` 로 내용, `SQL Editor`(⌘])로 쿼리.
4. 팁: `Schemas` 우클릭 → `View Diagram` 이 ER 다이어그램을 그려 준다. 트리에 `information_schema`·`pg_catalog` 만 보이면 연결 설정 → `PostgreSQL` 탭 → "Show all databases" 를 켠다.

`gforest_admin` 은 RLS 를 우회하는 관리자 롤이다. 앱과 같은 권한으로(RLS 걸린 채) 보고 싶으면 사용자 `gforest_app` / 비밀번호 `gforest_app` 으로 연결을 하나 더 만든다 — 이때는 세션에 `select set_config('app.user_id', '<프로필 uuid>', false);` 를 먼저 실행해야 회원 게시판이 보인다.

- 실제 사이트 모양의 데이터(글 4만 건, 가명화)가 필요하면 담당자에게 **가명화 덤프**를 요청한다. 받은 파일은 `npm run db:reset` 후 `gunzip -c gforest-anon.sql.gz | docker compose exec -T db psql -U gforest_admin -d gforest` 로 넣는다. 원본 XE 덤프(개인정보)는 배포하지 않는다.
- 끝낼 때 `npm run db:down`(컨테이너 정지, 데이터 유지). 꼬이면 `npm run db:reset`(전부 초기화, 20초).
- 사용 포트: 3000(앱), 5432(Postgres), 9000/9001(MinIO). 로컬에 다른 Postgres 가 5432 를 쓰고 있으면 그것을 멈추거나 `docker-compose.yml` 의 포트를 바꾼다(커밋하지 말 것).

## 7. Claude Code 설정 (선택)

```sh
cd ~/dev/gforest
claude            # 첫 실행: 브라우저로 claude.ai 로그인
```

- 저장소의 `.mcp.json` 이 Atlassian MCP 서버(`atlassian-gforest`)를 정의한다. 첫 세션에서 "프로젝트 MCP 서버를 쓸까요?" 확인창이 뜨면 **허용**한다. `.env` 의 토큰을 읽어 뜬다(`uv` 필요).
- `CLAUDE.md`(원칙)와 `.claude/settings.json`(허용 명령)은 저장소에 있어 자동 적용된다. 개인 설정은 `.claude/settings.local.json`, 개인 메모는 `CLAUDE.local.md`(둘 다 gitignore).
- 공용 명령: `/task GFM-n`(작업 시작), `/pr`(PR 까지), `/handover`(인수인계), 상세는 [claude-code.md](./claude-code.md) §2-1. 사례별 절차는 skill(`/db-migration`, `/add-board`, `/hotfix`, `/env-var`, `/infra-change`, `/dev-reseed`, `/dbshell`)로 있어 Claude 가 상황에 맞춰 스스로 호출한다.
- `/context` 를 치면 `CLAUDE.md` 와 `.claude/rules/` 가 로드됐는지 보인다. 긴 세션에서 `/compact`(요약)가 돌면 hook 이 브랜치·skill 목록을 다시 띄우는데, 그 뒤 Claude 가 skill 을 다시 호출하고 이어가는지 지켜본다(안 하면 `/db-migration` 처럼 직접 호출). 배경은 [claude-code.md](./claude-code.md) §2-2.
- 회사 등 **다른 Atlassian MCP 가 이미 연결돼 있으면 이 프로젝트에서는 쓰지 않는다** — `gforest.atlassian.net` 은 `atlassian-gforest` 서버만.

## 8. 첫 작업 — 흐름 익히기

1. Jira `GFM` 보드에서 이슈를 하나 맡는다(없으면 만든다: 타입 `작업`).
2. `claude` → `/task GFM-n` (또는 수동: `git checkout develop && git pull && git checkout -b feat/GFM-n-slug`).
3. 코드를 고치고 로컬에서 확인한다. 사례별 순서는 [playbooks.md](./playbooks.md).
4. `npm run check` (tsc·eslint·build — CI 와 같은 검사).
5. `/pr` (또는 수동: 커밋 → push → `gh pr create --base develop`). PR 제목은 `type: 무엇을 (GFM-n)`.
6. GitHub 에서 `ci` 초록 확인 → 병합 권한자가 **squash** 병합.
7. 몇 분 뒤 `https://dev.gforest.or.kr/version` 에 내 커밋이 보이면 dev 에서 화면을 확인한다. Discord `#deploy` 에도 알림.

**CI/CD 가 하는 일**(상세: [cicd-and-ops.md](./cicd-and-ops.md))

```
PR 열림 ──────── ci.yml: npm ci → tsc → eslint → next build (DB 없이)          ← 초록이어야 병합 가능
develop 병합 ─── ecs-deploy.yml: Docker 이미지 빌드 → ECR → DB 마이그레이션(VPC 안) → ECS dev 갱신 → 헬스체크 → Discord
develop→main ─── 같은 파이프라인이 prod 로 (Owner 승인 후) + 날짜 태그 자동
```

개발자는 AWS 콘솔에 들어갈 일이 없다. 배포 로그는 GitHub Actions 탭, 배포된 버전은 `/version` 페이지.

## 9. 문제 해결

| 증상 | 처방 |
|---|---|
| `npm run db:up` 이 이미지 pull 에서 멈춤 | Docker Desktop 재시작 → 재시도. 사내망이면 프록시 설정 |
| `permission denied: db/bootstrap.sh` | `chmod +x db/bootstrap.sh db/local/reset.sh` (클론 방식에 따라 실행 비트가 빠질 수 있음) |
| `bash: ... ^M: bad interpreter` (Windows) | CRLF 로 클론됨 → `git config --global core.autocrlf false` 후 다시 클론 |
| 5432 포트 충돌 | 로컬 Postgres 중지(`brew services stop postgresql` 등) 또는 compose 포트 변경 |
| `next dev` 가 느림 (Windows) | 저장소가 `/mnt/c` 에 있다 → WSL 홈(`~/dev`)으로 옮긴다 |
| 로그인 안 됨 | 테스트 계정 비밀번호 `DevTest!2026`. 가명화 덤프의 회원은 비밀번호가 없다(설계상) |
| 첨부 이미지 깨짐 | 파일 본체가 MinIO 에 없어서. 샘플 데이터는 첨부가 없고, 가명화 덤프도 메타만 있다 — 화면 검증에는 지장 없음 |
| 메일이 안 옴 | 로컬은 발송 대신 서버 콘솔에 내용이 찍힌다(정상) |
| Claude 가 MCP 를 못 찾음 | `uv --version` 확인, `.env` 값 확인, `claude mcp list` 로 상태 보기 |
| CI 는 실패하는데 로컬 빌드는 됨 | 빌드 시점 DB 접근이 들어갔다 — playbooks §3 |

## 10. 점검표

- [ ] GitHub 2FA + 조직 멤버, `gh auth status` 정상
- [ ] `node -v` 22, `docker compose version` 정상
- [ ] `npm run db:up` → 컨테이너 2개 healthy, `npm run dev` → localhost:3000 로그인 성공
- [ ] `npm run check` 통과
- [ ] DBeaver 로 `localhost:5432/gforest` 접속, `public.boards` 38행 확인
- [ ] `.env`·`.env.local` 이 `git status` 에 안 나옴
- [ ] (Claude) `claude` 로그인, `/task`·`/db-migration` 이 목록에 보임, `/context` 에 `CLAUDE.md` 가 보임, Jira 이슈를 읽어 옴
- [ ] Discord `#deploy` 알림 수신
