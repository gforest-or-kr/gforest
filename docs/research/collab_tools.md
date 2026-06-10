# 협업 도구 검토 — Atlassian 무료 플랜 + MCP (2026-06-10)

## 결론

- **Jira + Confluence를 같은 Atlassian Cloud 사이트에서 제품당 10명까지 완전 무료**로 사용 가능
- **비영리 단체는 더 유리**: 2026-02 발표된 Atlassian for Nonprofits로 자격 검증(Goodstack, 2~3일) 시 **Standard/Premium 25명까지 100% 무료** (Teamwork Collection: Jira+Confluence+Loom)
- **공식 Remote MCP 서버는 Free 플랜 포함 전 고객 무료** (시간당 500콜 제한) → Claude Code에서 OAuth로 연결, Confluence 페이지 생성·수정 / Jira 이슈 생성·조회·전환 자동화 가능

## Free 플랜 제약 (10명)

| 항목 | Free 플랜 |
|---|---|
| 스토리지 | 제품당 2GB |
| 권한 | 커스텀 권한 불가 (모든 사용자가 모든 스페이스 열람·편집), 익명 접근 불가 |
| 게스트/외부 공유 | 미지원 |
| 자동화 | Jira 월 100회, Confluence 자동화 없음 |
| 지원 | 커뮤니티 포럼만 |
| 기타 | 장기 미접속 시 사이트 비활성화 가능 |

→ 조합 내부 개발 문서·이슈 관리 용도로는 충분. 권한 분리가 필요해지면 비영리 라이선스(Standard 25명 무료)로 전환.

## MCP 연결 방법 (Claude Code)

```bash
claude mcp add --transport http atlassian https://mcp.atlassian.com/v1/mcp
# Claude Code 내 /mcp → atlassian 선택 → 브라우저 OAuth 동의
```

- 인증: OAuth 2.1 (별도 앱 등록 불필요). 구형 `/v1/sse` 엔드포인트는 2026-06-30 폐기 예정 — 사용 금지
- OAuth 문제 시 우회: `npx -y mcp-remote@latest https://mcp.atlassian.com/v1/mcp/authv2`
- 가능 작업: Confluence 페이지 생성/수정/검색, Jira 이슈 생성/수정/JQL 검색/상태 전환, 이슈↔문서 연결
- 표준 읽기·쓰기는 Rovo 크레딧 소모 없음. 레이트 리밋: Free 500콜/시간
- 대안(불필요 시 무시): 커뮤니티 sooperset/mcp-atlassian — Server/DC 지원·헤드리스 자동화용. Cloud Free + Claude Code 조합은 공식 서버가 가장 간단

## 비영리 라이선스 신청

- 자격: 비정부·비상업·비정치 등록 비영리 단체 (교육기관은 제외 명시 — **학부모조합(비영리 단체) 명의로 신청할 것**, 학교 명의 아님)
- 절차: https://www.atlassian.com/teams/nonprofits/discount-pricing → Goodstack 검증(고유번호증 등 필요 예상) → Social Impact License 적용
- 기타 제품(Trello, JSM 등)은 75% 할인

## 결정 사항

- 프로젝트 전용 Atlassian Cloud 무료 사이트 신규 생성 (회사 계정과 분리)
- Discord를 커뮤니케이션 툴로 사용, GitHub/Vercel/Jira·Confluence 알림을 webhook으로 연결
