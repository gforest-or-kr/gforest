#!/usr/bin/env bash
# SessionStart(compact) hook — compact 직후 Claude 에게 작업 맥락과 "다시 로드할 것"을 알려 준다.
# stdout 이 그대로 Claude 컨텍스트에 들어간다. 설정: .claude/settings.json hooks.SessionStart(matcher=compact)
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" 2>/dev/null || exit 0
branch=$(git branch --show-current 2>/dev/null)
issue=$(printf '%s' "$branch" | grep -oE 'GFM-[0-9]+' | head -1)
echo "[compact 복구] 브랜치: ${branch:-?} / 이슈: ${issue:-없음}"
changed=$(git status --short 2>/dev/null | head -15)
[ -n "$changed" ] && { echo "커밋되지 않은 변경:"; echo "$changed"; }
echo "요약만 믿고 이어가지 말 것: 진행 중 사례의 skill 을 다시 호출하고, 만지는 파일의 rule(.claude/rules) 이 로드됐는지 확인한 뒤 계속한다. 인수인계 원본은 Jira ${issue:-이슈} 코멘트 + PR 본문."
echo "사용 가능한 skill (compact 후 목록이 사라지므로 다시 적음):"
for f in .claude/skills/*/SKILL.md .claude/commands/*.md; do
  [ -f "$f" ] || continue
  n=$(basename "$(dirname "$f")"); [ "$n" = commands ] && n=$(basename "$f" .md)
  d=$(sed -n 's/^description: *//p' "$f" | head -1)
  echo "  /$n — $d"
done
exit 0
