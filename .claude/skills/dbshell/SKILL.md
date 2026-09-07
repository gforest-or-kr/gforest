---
name: dbshell
description: dev/prod RDS 의 실제 데이터를 psql 로 봐야 할 때(배포 후 이상 확인, 회원 상태 점검). 인프라 담당만. VPC 안 컨테이너 + ECS Exec, RDS 는 계속 비공개. 기본은 --readonly.
---
# 운영 DB 조회 (dbshell)

스키마·데이터 모양만 보려면 로컬 DB(DBeaver, `docs/conventions/onboarding.md` §6-1)로 충분하다. **누가**: 인프라 담당(Identity Center). RDS 는 공개로 열지 않는다.

```sh
aws sso login --profile gforest --use-device-code
AWS_PROFILE=gforest db/tools/dbshell.sh dev --readonly   # 조회만 (기본으로 이걸 쓴다)
AWS_PROFILE=gforest db/tools/dbshell.sh dev              # 관리자, 쓰기 가능 — 데이터 수정은 마이그레이션이 원칙, 정말 필요할 때만
AWS_PROFILE=gforest db/tools/dbshell.sh dev --app        # 앱 롤(gforest_app) — RLS 가 걸린 채로 (권한 문제 재현용)
```

- VPC 안에 `gforest-<env>-dbshell` 컨테이너(postgres:17-alpine)를 띄우고(10~20초) ECS Exec 으로 psql 이 열린다. `\q` 로 나가면 컨테이너는 자동 정리된다. 세션 기록은 CloudWatch `/ecs/gforest-exec`(90일).
- 필요한 것: aws CLI v2 + `session-manager-plugin`(`brew install --cask session-manager-plugin`, 관리자 권한 없으면 AWS 배포 zip 의 `bin/session-manager-plugin` 을 `~/.local/bin` 에).
- **prod 에서는 `--readonly` 만 쓴다.** 쓰기가 필요하면 마이그레이션 파일(skill `db-migration`)로 만들어 릴리스한다.
- 테스트로 만든 객체(`create table zz_test` 등)는 남기지 않는다. `--readonly` 는 CREATE 를 거부한다.
- 옛 방식(RDS 비상 개방)은 dbshell 이 안 될 때의 최후 수단이다.
