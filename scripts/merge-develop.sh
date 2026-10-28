#!/usr/bin/env bash
# develop 대상 PR 을 squash 병합하는 래퍼 (GFM-100). Claude 명령 /merge 가 쓴다. core 팀·Owner 만 서버가 허용한다.
#   scripts/merge-develop.sh <PR번호>
# 하는 일: base=develop · ci pass(그 밖의 fail/pending 없음) · 제목 `type: 무엇을 (GFM-n)` 을 확인한 뒤
#   gh pr merge <n> --squash --delete-branch --admin  (--admin 은 gh 가 BLOCKED 를 클라이언트에서 거르지 않게 할 뿐, 허용은 서버의 룰셋 bypass)
# 거부: main 대상(릴리스·핫픽스는 사람이 웹에서 merge commit), 체크 미통과, 제목 형식 불일치. 다른 플래그·강제 수단은 없다.
# gh pr merge 자체는 공유 허용 목록에 넣지 않는다 — 원격 제어 세션에서 쓰려면 core 담당자 개인 settings.local.json 에 이 스크립트만 허용.
set -euo pipefail

n="${1:-}"
[[ "$n" =~ ^[0-9]+$ ]] || { echo "usage: scripts/merge-develop.sh <PR번호>" >&2; exit 2; }

info=$(gh pr view "$n" --json number,title,baseRefName,headRefName,state,url)
state=$(jq -r .state <<<"$info"); base=$(jq -r .baseRefName <<<"$info")
title=$(jq -r .title <<<"$info"); head=$(jq -r .headRefName <<<"$info"); url=$(jq -r .url <<<"$info")
echo "#$n $title"; echo "base=$base head=$head state=$state"; echo "$url"

[ "$state" = OPEN ] || { echo "열린 PR 이 아니다($state)" >&2; exit 1; }
[ "$base" = develop ] || { echo "base 가 develop 이 아니다($base) — main 대상은 사람이 웹에서 merge commit" >&2; exit 1; }
[[ "$title" =~ ^(feat|fix|infra|docs|chore|perf|ci|refactor|test|style):\ .+\ \(GFM-[0-9]+\)$ ]] \
  || { echo "제목이 'type: 무엇을 (GFM-n)' 형식이 아니다 — squash 커밋 제목이 되므로 먼저 고친다" >&2; exit 1; }

checks=$(gh pr checks "$n" 2>/dev/null || true)
echo "$checks"
grep -qE '^ci[[:space:]]+pass' <<<"$checks" || { echo "ci 가 pass 가 아니다" >&2; exit 1; }
if grep -vE '^release-guard[[:space:]]' <<<"$checks" | grep -qE '[[:space:]](fail|pending)[[:space:]]'; then
  echo "fail 또는 pending 인 체크가 있다" >&2; exit 1
fi

gh pr merge "$n" --squash --delete-branch --admin
