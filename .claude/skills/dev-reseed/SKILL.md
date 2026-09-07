---
name: dev-reseed
description: 로컬 또는 dev 에 XE(cafe24) 데이터를 다시 투입할 때. 로컬은 db:reset → xe:etl --anonymize, dev 는 인프라 담당이 reset-env.sh dev → ETL → 첨부 복사. prod 에는 실행 금지.
---
# dev 데이터 재투입

**언제**: 게시판 매핑·역할 규칙을 바꿔 실제 글 모양을 다시 보고 싶을 때, dev 데이터가 어지러워졌을 때. 로컬은 언제든, dev 는 인프라 담당이. 도구 상세: `db/tools/xe/README.md`.

## 로컬
```sh
npm run db:reset                          # 볼륨 삭제 후 스키마·시드·샘플 재생성
npm run xe:etl -- --anonymize             # XE 복제본(docker profile xe, MariaDB) → 로컬 Postgres, 약 20초
npm run xe:files -- --since 2025          # 첨부 본체(HTTP → MinIO), 2025년 이후 약 900MB. 선택
```
XE 복제본이 없으면 `db/tools/xe/README.md` §1(덤프는 인프라 담당에게 받는다 — `db/tools/xe/dump/` 는 gitignore, 개인정보라 공유 금지).

## dev (인프라 담당)
1. RDS 비상 개방(`infra/env/dev.tfvars` `db_publicly_accessible=true` + 본인 IP `/32` → apply).
2. `db/tools/xe/reset-env.sh dev` → ETL(가명화) → 첨부 복사. 명령은 `db/tools/xe/README.md` §2.
3. RDS 닫기(false 로 되돌려 apply). 테스트 계정 4개는 자동으로 다시 생긴다.
4. **prod 에는 이 스크립트가 실행되지 않는다**(스크립트가 거부한다).

## 확인
`https://dev.gforest.or.kr` 에서 공지 목록·회원 게시판·첨부 이미지. 건수는 로컬과 같아야 한다(회원 3,036 / 글 41,361 / 댓글 61,956 기준, 2026-09-06).
