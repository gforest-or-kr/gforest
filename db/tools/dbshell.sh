#!/usr/bin/env bash
# 운영 DB(dev/prod RDS)에 psql 열기 — RDS 를 공개로 열지 않고, VPC 안에 postgres 컨테이너를 잠깐 띄워 ECS Exec 으로 들어간다.
#   AWS_PROFILE=gforest db/tools/dbshell.sh dev              # 관리자 롤(gforest_admin), 읽기/쓰기
#   AWS_PROFILE=gforest db/tools/dbshell.sh dev --readonly   # 같은 롤이지만 세션이 read-only (실수 방지)
#   AWS_PROFILE=gforest db/tools/dbshell.sh dev --app        # 앱 롤(gforest_app) — RLS 가 걸린 채로 본다
# 전제: Identity Center admins, aws CLI v2 + session-manager-plugin(brew install --cask session-manager-plugin).
# 세션 로그는 CloudWatch /ecs/gforest-exec 에 남는다. 끝나면(exit) 태스크를 정리한다.
set -euo pipefail
env_name="${1:?dev|prod}"; shift || true
mode="admin"
for a in "$@"; do case "$a" in --readonly) mode=readonly;; --app) mode=app;; *) echo "unknown option $a"; exit 1;; esac; done
cluster=gforest; family="gforest-${env_name}-dbshell"
command -v session-manager-plugin >/dev/null || { echo "session-manager-plugin 이 없습니다: brew install --cask session-manager-plugin"; exit 1; }

net=$(aws ecs describe-services --cluster "$cluster" --services "gforest-${env_name}" --query 'services[0].networkConfiguration' --output json)
task=$(aws ecs run-task --cluster "$cluster" --launch-type FARGATE --task-definition "$family" --enable-execute-command \
         --network-configuration "$net" --query 'tasks[0].taskArn' --output text)
echo "dbshell task: ${task##*/} (${env_name}, ${mode})"
trap 'echo "stopping task…"; aws ecs stop-task --cluster "$cluster" --task "$task" --reason "dbshell exit" >/dev/null 2>&1 || true' EXIT

echo -n "waiting for exec agent"
for i in $(seq 1 40); do
  st=$(aws ecs describe-tasks --cluster "$cluster" --tasks "$task" --query 'tasks[0].[lastStatus, containers[0].managedAgents[0].lastStatus]' --output text | tr '\t' '/')
  case "$st" in RUNNING/RUNNING) echo " ready"; break;; STOPPED*) echo; aws ecs describe-tasks --cluster "$cluster" --tasks "$task" --query 'tasks[0].stoppedReason' --output text; exit 1;; esac
  echo -n "."; sleep 3
done
[ "${st:-}" = RUNNING/RUNNING ] || { echo " timeout"; exit 1; }

case "$mode" in
  admin)    cmd='psql "$PGURL_ADMIN"' ;;
  readonly) cmd='PGOPTIONS="-c default_transaction_read_only=on" psql "$PGURL_ADMIN"' ;;
  app)      cmd='psql "$PGURL_APP"' ;;
esac
aws ecs execute-command --cluster "$cluster" --task "$task" --container psql --interactive --command "sh -c '$cmd'"
