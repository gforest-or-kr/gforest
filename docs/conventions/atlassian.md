# Atlassian (Jira · Confluence) 작성 규약

> Jira 이슈를 전환하거나 Confluence 문서를 작성·갱신할 때의 실무. 페이지 ID·전환 ID·작성법·
> 함정이 여기 모여 있다. **비밀값(API 토큰)은 여기 없다** — 접근 방법만 기술한다.

## 접근 방법

- **cloudId / 사이트**: `gforest.atlassian.net`
- **Claude 세션**: Atlassian MCP 서버(`atlassian`)가 연결돼 있으면 `mcp__atlassian__*` 도구로 직접 작업.
  연결돼 있지 않으면 `claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp` 후 OAuth.
- **스크립트/REST**: `.env`의 `ATLASSIAN_EMAIL` + `ATLASSIAN_API_TOKEN`으로 Basic 인증
  (`Authorization: Basic base64(email:token)`). `.env`는 gitignore — 커밋 금지.
- 토큰 분실/재발급: id.atlassian.com → Security → API tokens.

---

## Jira

- **프로젝트 키**: `GFM` · 이슈 타입: `작업`(Task)
- **워크플로 동기화 (필수 규칙)**: 작업 **시작 시** 해당 이슈를 `진행 중`으로, **완료 시** `완료`
  (리뷰 필요하면 `검토 중`)로 전환한다. 해당 이슈가 없으면 **먼저 만든다**. 커밋 메시지에 이슈 키 포함.
- **전환(transition) ID** (MCP `transitionJiraIssue` / REST 공통):

  | 상태 | transition id |
  |---|---|
  | 할 일 | `11` |
  | 진행 중 | `21` |
  | 검토 중 | `31` |
  | 완료 | `41` |

- **커밋 메시지**: `feat: ... (GFM-2)` 처럼 이슈 키를 넣는다.
- **상태 조회**: JQL `project = GFM ORDER BY key ASC` 등. MCP `searchJiraIssuesUsingJql`.
- Confluence 계획서·보고서의 진행 현황은 **Jira 매크로로 자동 연동**되므로 위키를 수동 갱신하지 않는다(아래 매크로 참조).

---

## Confluence

### 스페이스 구조

- **스페이스 키**: `gforestMigration` · **스페이스 ID**: `163844` · **홈페이지 ID**: `163956`
- **섹션(상위) 페이지 ID** — 새 문서는 적절한 섹션 아래에 만든다:

  | 섹션 | 페이지 ID | 용도 |
  |---|---|---|
  | 01 계획 | `589825` | 마이그레이션 계획서, 구축 보고 |
  | 02 리서치 | `589846` | 사이트 분석, 호스팅·스택 의사결정, 성능 |
  | 03 설계 | `589866` | 화면설계서, DB 스키마 |
  | 04 회의록 | `589886` | 조합·개발자 그룹 논의 |
  | 05 운영 | `557065` | CI/CD, 인프라·자격증명 레퍼런스 |

- 홈(`163956`)은 README형 대시보드 + `recently-updated` 매크로(최근 편집 자동 표시).

### 페이지 작성법 — **핵심 규칙**

**MCP `createConfluencePage` / `updateConfluencePage`를 `contentFormat: "html"`로 쓰고, 네이티브 ADF
요소를 사용한다.** 표준 HTML(`<h2>`, `<p>`, `<table>` + 셀 안에 `<p>`, `<strong>`, `<a>`, `<ul>/<ol>`)에
더해 Confluence 전용 요소는 `data-type` 속성으로:

```html
<div data-type="panel-info"><p>정보 패널</p></div>
<div data-type="panel-success"><p>성공/결론</p></div>
<div data-type="panel-warning"><p>주의</p></div>
<div data-type="panel-error"><p>경고/금지</p></div>
<div data-type="panel-note"><p>참고</p></div>
<details><summary>접기 제목</summary><p>접힌 내용</p></details>
```

> ⚠️ **함정**: storage-format의 `<ac:structured-macro ac:name="info">…</ac:structured-macro>` 패널을
> REST로 직접 넣으면 **새 렌더러에서 "Error loading the extension!"** 로 깨진다(본문 곳곳에 빨간 에러).
> 패널이 필요하면 반드시 위의 `contentFormat: html` + `<div data-type="panel-*">`를 쓴다.
> storage-format 직접 작성은 **아래 Jira 매크로처럼 진짜 연동 매크로가 필요할 때만**.

### Jira 매크로 임베드 (storage-format 필요한 유일 케이스)

진행 현황을 라이브로 연동하려면 storage format으로 작성한다(REST `body.storage`):

- **serverId**: `cee3a010-ae17-338c-add5-08e21648fb04` · server name `System Jira`
- JQL 테이블:
  ```
  <ac:structured-macro ac:name="jira">
    <ac:parameter ac:name="server">System Jira</ac:parameter>
    <ac:parameter ac:name="serverId">cee3a010-ae17-338c-add5-08e21648fb04</ac:parameter>
    <ac:parameter ac:name="jqlQuery">project = GFM AND status = 완료 ORDER BY key</ac:parameter>
  </ac:structured-macro>
  ```
- 단일 이슈 인라인: 위에서 `jqlQuery` 대신 `<ac:parameter ac:name="key">GFM-2</ac:parameter>`.

### 첨부 갱신 (같은 파일명 덮어쓰기)

이미 있는 첨부를 갱신할 땐 `POST /wiki/rest/api/content/{pageId}/child/attachment/{attachmentId}/data`
(multipart, 헤더 `X-Atlassian-Token: nocheck`). 첨부 ID는
`GET .../child/attachment`로 조회. 새로 만들 땐 `/child/attachment`에 POST.

---

## 다이어그램 워크플로 (draw.io)

원본은 repo `docs/diagrams/*.drawio`(단일 진실). Confluence에는 **PNG를 본문 기본 표시 + draw.io
매크로는 접기 블록 안**에 둔다 — **Confluence 모바일 앱이 서드파티(Forge) 매크로를 렌더링하지 못하기**
때문(탭해도 무반응). 다이어그램 수정 시 PNG도 함께 갱신한다.

### .drawio → PNG 렌더 파이프라인

로컬에 Confluence 로그인 없이 PNG를 뽑는 검증된 방법:

1. drawio XML을 `viewer-static.min.js`로 감싼 로컬 HTML 생성:
   ```html
   <div class="mxgraph" data-mxgraph='{"xml": "...drawio 내용...", "toolbar": ""}'></div>
   <script src="https://viewer.diagrams.net/js/viewer-static.min.js"></script>
   ```
2. cmux 브라우저로 그 HTML을 열고 `screenshot`으로 캡처.
3. **Pillow로 흰 여백 트리밍** — 흰색과 diff한 bbox + 24px 마진으로 crop (실제 그림 영역만).
4. Confluence 페이지에 PNG inline(`<ac:image><ri:attachment ri:filename="x.png"/></ac:image>`) +
   draw.io 매크로를 `<details>` 접기 블록 안에 배치.

> 라벨 겹침은 엣지에 전용 레인(waypoint x좌표 분리)과 라벨 오프셋으로 해결. 렌더 후 반드시
> 스크린샷을 눈으로 확인할 것.

---

## 비밀값·실제 식별자는 어디에

- 실제 키·토큰·DB 비밀번호·테스트 계정·웹훅 URL → Confluence **05 운영 > "인프라·자격증명
  레퍼런스"** 페이지(팀 전용 보안 경계). repo·이 문서에는 두지 않는다.
- 로컬 비밀값: `.env`(Atlassian), `.env.local`(Supabase). 둘 다 gitignore.
