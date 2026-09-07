---
paths:
  - "docs/**"
  - "CLAUDE.md"
  - "README.md"
  - ".claude/**"
---
# 문서·Confluence·Claude 설정 규칙 — 이유·상세: `docs/conventions/atlassian.md`, `claude-code.md`

- **repo 문서가 원본, Confluence 는 미러.** 규칙은 CLAUDE.md(원칙) / `docs/conventions`(절차) / `docs/design`·`research`(근거) 중 한 층에만 쓰고 나머지는 링크. CLAUDE.md 는 200줄 이내, 원칙만.
- Confluence·Jira 는 `mcp__atlassian-gforest__*` 만 쓴다(회사 Atlassian MCP 금지). 스페이스 `gforestMigration`, 섹션 페이지 ID 는 `atlassian.md`.
- 미러 갱신(markdown) 함정: 한 줄에 `$` 가 두 개면 수식으로 깨진다 → 금액은 `USD 12`; 상대 `.md` 링크는 `https://github.com/gforest-or-kr/gforest/blob/develop/<경로>` 로 바꿔 올린다; `content_file` 은 repo 안 경로(`.tmp-confluence/`, 올린 뒤 삭제); `page_width` 는 넘기지 않는다(팀 결정: 기본 너비); 패널은 `contentFormat: html` + `<div data-type="panel-*">`.
- 다이어그램은 `docs/diagrams/*.drawio` 가 원본. 고치면 PNG 도 다시 만들어 Confluence 에 올린다(모바일 앱은 draw.io 매크로를 못 그린다).
- 문서에 비밀값·개인정보(회원 이름, 계좌 등)를 쓰지 않는다. 계정 정보는 Confluence 05 운영 팀 전용 페이지에만.
- `.claude/`(rules·skills·commands·hooks) 변경은 규약 문서(`claude-code.md`, `playbooks.md`)와 같은 PR 에서. skill 본문은 5,000토큰 이내, 중요한 순서를 위에.
- 게시판 수는 38(시드 기준: 8+23+7).
