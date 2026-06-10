# 서버리스 vs AWS 자체 구축 비교 (2026-06-11)

> 회원 ~300명, 동시접속 수십 명 이하의 학교 커뮤니티 기준.
> 서버리스(Vercel Hobby + Supabase Free, Seoul)와 AWS 저사양 자체 구축을 비용·방식·성능·장단점·유지보수성 관점에서 비교.
> 가격은 2026-06 기준 USD, AWS는 서울(ap-northeast-2) 리전 공식 Price List 실측.

## 0. 핵심 질문에 대한 답: "300명 규모에서 서버리스 품질은?"

**결론: 충분하다.** 정량 한도가 이 규모 대비 10배 이상 여유이며, 체감 속도는 설정만 올바르면 자체 서버와 차이를 느끼기 어렵다.

| 지표 | 기대치 | 조건 |
|---|---|---|
| 정적/ISR 페이지 (소개, 공지 목록 등) | **TTFB 수십 ms** (국내 실측 30~40ms) | Vercel 서울 PoP(icn1) CDN 캐시 |
| DB 조회 페이지 (게시판 SSR) | 서버 처리 100~400ms, **로드 0.5~1초** | **함수 리전 icn1 지정 필수** |
| 한산한 시간대 첫 요청 | +수백 ms~1초 (cold start) | Hobby는 상시 인스턴스 미보장 |
| 정량 한도 대비 사용률 | 대역폭/호출수/MAU 모두 10% 미만 예상 | 이미지 정책 전제 (아래 참조) |

300명·동접 수십 명은 Vercel(함수 100만 호출/월, 대역폭 100GB/월)과 Supabase(MAU 5만, 풀러 200연결)의 한도에 크게 못 미친다. **실질 병목은 트래픽이 아니라 ① 사진 용량(Storage 1GB, egress 5GB/월, 이미지 변환 5,000장/월) ② 방학 중 Supabase 7일 미사용 일시정지** — 둘 다 운영 정책(이미지 리사이즈 업로드, keep-alive ping)으로 완화 가능.

## 1. 비교 대상 정의

| | A. 서버리스 (현 계획) | B-1. Lightsail 올인원 | B-2. EC2 + RDS 분리 |
|---|---|---|---|
| 구성 | Vercel(Next.js) + Supabase(DB/Auth/Storage) | $12 인스턴스 1대에 Next.js+Postgres | EC2 t4g.small + RDS db.t4g.micro |
| 사양 | 관리형 (Nano shared CPU / Fluid Compute) | 2GB RAM / 2 vCPU / 60GB SSD / 전송 3TB | 2GB RAM + 관리형 PG 1GB |
| 서버 관리 | 없음 | 전부 직접 | OS는 직접, DB는 관리형 |

## 2. 비용 비교 (월, 도메인 제외)

| 항목 | A. 서버리스 | B-1. Lightsail 올인원 | B-2. EC2+RDS |
|---|---|---|---|
| 기본 비용 | **$0** | **~$13** (스냅샷 포함) | **~$43** (온디맨드) / ~$34 (1yr RI) |
| 첫 해 혜택 | 해당 없음 (계속 무료) | 3개월 무료 | 신규계정 $100~200 크레딧 (6개월 한정) |
| 연간 환산 | **$0** | **~$156** (약 21만원) | **~$410~516** (약 55~70만원) |
| 업그레이드 압력 시 | Supabase Pro $25 + Vercel Pro $20 | $24 플랜(4GB)으로 +$12 | 인스턴스 업사이징 |
| 숨은 비용 | 광고/모금 부착 시 Vercel Pro 강제($20) | EC2 대비 저렴하나 백업 외부보관 별도 | IPv4 $3.65/월, Unlimited 버스트 초과금 |

참고: AWS 신규 계정은 2025-07부터 **12개월 무료 티어가 폐지**되고 $100~200 크레딧(6개월)으로 대체 — "무료로 1년" 전략은 더 이상 불가. EC2 올인원(t4g.small)은 ~$23/월로 Lightsail의 약 2배(IPv4 유료화 $3.65 영향 큼).

## 3. 성능 비교

| 관점 | A. 서버리스 | B. 자체 서버 (2GB급) |
|---|---|---|
| 정적 페이지 | CDN 수십 ms — **우세** | 단일 서버 직접 서빙, 50~150ms 수준 |
| DB 페이지 | 0.5~1초 (리전 정렬 시) | 0.3~0.8초 (로컬 DB라 RTT 없음) — 약간 우세 |
| 콜드스타트 | 한산 시간대 첫 요청 +1초 내외 | **없음** (상시 구동) — 우세 |
| 부하 급증 (입학설명회 등) | **자동 확장** — 우세 | T계열 버스트 크레딧 소진 시 스로틀(0.4코어) 또는 추가 과금 |
| 동시 수십 명 | 무난 (풀러 200연결) | 무난 (ISR/캐싱 전제) |
| 주의점 | 함수 리전 icn1 미지정 시 전 페이지 +1초 | t4g.micro(1GB)는 next build OOM — 2GB 필수 |

요약: **평시 체감 속도는 비등**하다. 자체 서버는 cold start가 없어 한산할 때 미세하게 유리하고, 서버리스는 갑작스러운 트래픽(입학 시즌)에 강하다. 어느 쪽도 이 규모에서 "느려서 못 쓰는" 상황은 없다.

## 4. 장단점

### A. 서버리스 (Vercel + Supabase)

**장점**
- 월 0원, 서버 관리 업무 자체가 없음 (OS/보안/SSL/스케일링 전부 위임)
- Auth/Storage/RLS 내장 — 직접 구현할 코드가 적음
- git push = 배포, 롤백 원클릭. 장애 시 플랫폼이 복구
- 자동 확장 — 입학 시즌 트래픽 걱정 없음

**단점**
- 두 서비스 의존 — 약관·요금 정책 변경 리스크 (완화: 표준 Postgres 유지로 `pg_dump` 탈출 가능 설계, 이미 운영 원칙에 반영)
- cold start, 7일 pause 등 "무료 티어 특유의 잔손질" 필요 (ping cron으로 해결)
- Vercel Hobby 비상업 약관 — 광고·후원 모금 불가
- 이미지 한도(1GB/5GB egress)가 가장 먼저 닿는 천장

### B. AWS 자체 구축

**장점**
- 단일 서버에 모든 것 — 아키텍처가 단순하고 의존 서비스 없음
- cold start 없음, 약관 제약 없음 (광고/모금 자유)
- 리소스를 온전히 점유 — 무료 티어 한도성 제약 없음
- WebSocket 등 장기 연결 자유

**단점**
- **연 $156~516 고정 비용** (조합 예산 필요)
- 운영 업무가 실제로 발생: OS 패치, SSH/방화벽 보안(공인 IP는 24시간 자동 공격 대상), SSL 갱신 모니터링, pg_dump 백업+외부 보관+복구 리허설, 디스크/로그 관리, OOM·프로세스 다운 대응, 버전 업그레이드
- Auth(비밀번호 해시, 세션, 재설정 메일), 파일 업로드 보안 등을 직접 구현 — 개발량 증가
- **담당자 인수인계 단절이 최대 리스크** — 학부모조합처럼 운영 주체가 바뀌는 조직에서 가장 흔한 실패 원인

## 5. 유지보수성 (이 프로젝트의 최우선 가치 기준)

| 관점 | A. 서버리스 | B. 자체 구축 |
|---|---|---|
| 평시 운영 업무 | **0건** (월 1회 대시보드 확인 수준) | 주 단위 패치·모니터링, 월 단위 백업 검증 |
| 장애 시 | 플랫폼이 복구 (대기만) | 직접 SSH 접속해 진단·복구 |
| 보안 사고 면 | 플랫폼 책임 영역이 큼 | 패치 방치 시 XE1 꼴 재현 위험 |
| 인수인계 | URL/계정만 전달 | 서버 운영 지식 전체 전달 필요 |
| 데이터 유실 위험 | GitHub Actions pg_dump로 보완 | 백업 자동화+외부 보관을 직접 구축·검증 |

마이그레이션 계획서의 전제("전담 운영 인력 없음 → 서버 관리 업무 자체가 없어야 함")에 비추면 이 표가 결정적이다.

## 6. 결론 및 권고

1. **현 계획(서버리스) 유지 권고.** 300명 규모에서 성능은 충분하고, 비용 0원에, 유지보수성은 압도적으로 우세하다. 자체 구축의 성능 이점(cold start 없음)은 미미한 반면, 운영 부담과 고정 비용은 실재한다.
2. 단, 서버리스 선택 시 **필수 설정 3가지**를 체크리스트에 반영: ① Vercel 함수 리전 `icn1` 지정 ② keep-alive ping (7일 pause 방지 — 이미 계획됨) ③ 이미지 리사이즈 업로드 정책 (Storage 1GB 보호)
3. **자체 구축으로 전환을 검토할 트리거**: 광고/후원 모금 도입 결정(Hobby 약관), 사진 용량이 정책으로 감당 불가(Supabase Pro $25 vs Lightsail $12 비교 시점), 또는 두 플랫폼의 무료 정책 대폭 축소. 그 경우 **Lightsail $12 올인원**이 자체 구축 중 최적 (EC2+RDS 분리는 이 규모에서 성능 이점 없이 3배 비용).
4. 이식성 원칙(표준 Postgres, `pg_dump` 탈출 가능)을 지키면 A→B 전환 비용은 낮게 유지된다 — 지금 서버리스로 시작하는 것이 잠금(lock-in) 리스크를 키우지 않는다.

## 출처

- Vercel: [Limits](https://vercel.com/docs/limits) · [Hobby Plan](https://vercel.com/docs/plans/hobby) · [Fair Use](https://vercel.com/docs/limits/fair-use-guidelines) · [Regions](https://vercel.com/docs/regions) · [Function Region](https://vercel.com/docs/functions/configuring-functions/region) · [Fluid Compute](https://vercel.com/docs/fluid-compute) · [Scale to One](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)
- Supabase: [Pricing](https://supabase.com/pricing) · [Compute and Disk](https://supabase.com/docs/guides/platform/compute-and-disk) · [90일 복구 정책](https://github.com/orgs/supabase/discussions/27497) · [리전 정렬 실측기](https://dongho.oopy.io/api-서버와-데이터베이스-간-네트워크-지연-문제-해결기)
- AWS: [Lightsail 요금](https://aws.amazon.com/lightsail/pricing/) · [EC2 온디맨드](https://aws.amazon.com/ec2/pricing/on-demand/) · [RDS PostgreSQL](https://aws.amazon.com/rds/postgresql/pricing/) · [IPv4 유료화](https://aws.amazon.com/blogs/aws/new-aws-public-ipv4-address-charge-public-ip-insights/) · [프리티어 개편](https://aws.amazon.com/blogs/aws/aws-free-tier-update-new-customers-can-get-started-and-explore-aws-with-up-to-200-in-credits/) · [버스터블 크레딧](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/burstable-credits-baseline-concepts.html) · [1GB Next.js 빌드 OOM](https://betterstack.com/community/guides/scaling-nodejs/fix-nextjs-build-failures/)
