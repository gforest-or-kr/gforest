#!/usr/bin/env bash
# dev 환경 Terraform 두 단계 apply — 원격 승인용 (GFM-99).
#   infra/env/apply.sh dev plan    워크스페이스 dev 고정 → plan 을 파일(.tfplan.dev)로 저장 → 추가/변경/삭제 요약 출력
#   infra/env/apply.sh dev apply   그 파일만 적용. 파일이 없거나 15분이 지났으면 거부(plan 을 다시 본다)
# 적용되는 것은 plan 단계에서 사람이 읽은 그 파일 그대로다 — 승인 = 요약을 읽은 뒤의 "apply" 지시.
# prod 는 받지 않는다(릴리스와 별개로 인프라 담당이 로컬 터미널에서 plan 을 보고 apply). destroy 는 어디서도 하지 않는다.
# 전제: AWS SSO 로그인(aws sso login --profile gforest --use-device-code). AWS_PROFILE 미설정이면 gforest.
set -euo pipefail

env_name="${1:-}"; step="${2:-}"
usage() { echo "usage: infra/env/apply.sh dev plan|apply" >&2; exit 2; }
[ "$env_name" = dev ] || { echo "dev 만 받는다(prod 는 로컬 터미널에서 terraform apply)" >&2; usage; }
[ "$step" = plan ] || [ "$step" = apply ] || usage

cd "$(dirname "$0")"
export AWS_PROFILE="${AWS_PROFILE:-gforest}"
plan_file=".tfplan.$env_name"
max_age_min=15

terraform init -input=false >/dev/null
terraform workspace select "$env_name" >/dev/null

case "$step" in
  plan)
    rm -f "$plan_file"
    set +e
    terraform plan -var-file="$env_name.tfvars" -input=false -no-color -detailed-exitcode -out="$plan_file" >/dev/null
    rc=$?
    set -e
    if [ "$rc" -eq 0 ]; then rm -f "$plan_file"; echo "변경 없음 — apply 할 것이 없다"; exit 0; fi
    [ "$rc" -eq 2 ] || { echo "plan 실패(exit $rc)" >&2; exit "$rc"; }
    echo "== plan 요약 ($env_name, 워크스페이스 $(terraform workspace show))"
    terraform show -no-color "$plan_file" | grep -E '^  # |^Plan:'
    echo "== 적용하려면: infra/env/apply.sh $env_name apply  (${max_age_min}분 안에)"
    ;;
  apply)
    [ -f "$plan_file" ] || { echo "저장된 plan 이 없다 — 먼저 'infra/env/apply.sh $env_name plan'" >&2; exit 1; }
    if [ -n "$(find "$plan_file" -mmin +"$max_age_min")" ]; then
      rm -f "$plan_file"; echo "plan 이 ${max_age_min}분보다 오래됐다 — 다시 plan 해서 확인" >&2; exit 1
    fi
    terraform apply -input=false -no-color "$plan_file"
    rm -f "$plan_file"
    ;;
esac
