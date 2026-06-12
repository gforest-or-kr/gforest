# spec: README 맨 끝에 한 줄 추가 (#1)

## 요약

`README.md` 파일의 맨 마지막에 인용(blockquote) 형식의 한 줄
`> Maintained with Maestro 🤖` 를 추가한다. 기존 내용은 일절 수정하지 않으며,
파일 끝의 개행(trailing newline)을 유지한다. 코드·동작 변경이 없는 문서 단일 파일 수정이다.

## 구현 계획

### 수정 파일: `README.md` (1개 파일, 이 파일만 수정)

현재 파일은 51번째 줄 `비영리 학부모조합 내부 프로젝트입니다. 광고·상업적 사용 불가(Vercel Hobby 약관).`
이 마지막 내용 줄이며, 그 뒤 개행(`\n`)으로 끝난다 (trailing newline 있음, 빈 줄 없음).

마크다운 관례에 따라 기존 마지막 문단과 새 blockquote 사이에 빈 줄 하나를 두고 추가한다.
수정 후 파일 끝부분은 다음과 같아야 한다:

```
비영리 학부모조합 내부 프로젝트입니다. 광고·상업적 사용 불가(Vercel Hobby 약관).

> Maintained with Maestro 🤖
```

- 마지막 줄 `> Maintained with Maestro 🤖` 뒤에는 개행 문자(`\n`) 하나로 파일이 끝나야 한다.
- 이슈 본문의 `> ` 접두사는 마크다운 blockquote 표기이므로 그대로 포함한다
  (추가되는 줄의 정확한 내용: `> Maintained with Maestro 🤖`).
- 기존 1~51줄은 한 글자도 변경하지 않는다.

## Acceptance Criteria

- [ ] `git diff`에서 변경된 파일이 `README.md` 단 하나다 (tasks/1/spec.md 제외).
- [ ] `README.md`의 마지막 내용 줄이 정확히 `> Maintained with Maestro 🤖` 이다
      (`tail -1 README.md` 결과로 확인 가능).
- [ ] 새 줄 바로 앞에 빈 줄이 하나 있다 (기존 마지막 문장과 blockquote가 한 문단으로 붙지 않음).
- [ ] 파일이 개행 문자로 끝난다: `tail -c 1 README.md | od -c` 결과가 `\n` 이다
      (git diff에 `\ No newline at end of file` 표식이 없어야 함).
- [ ] 기존 1~51줄 내용은 변경되지 않았다 — diff가 줄 추가(+)만 있고 삭제(-)나 수정이 없다.

## 범위 제외

- README의 다른 섹션 수정·재구성·오타 수정 일체.
- CLAUDE.md 등 다른 문서 파일 변경.
- Jira 이슈 생성/전환 (이 작업은 GitHub 이슈 #1 기반의 Maestro 파이프라인으로 추적되며,
  커밋·이슈 댓글은 watcher가 수행한다).
