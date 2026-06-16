# 레거시 미디어 스토리지 전략 (2026-06)

> **목적**: 학부모 개발자 분석 리포트(2026-06)가 지적한 최대 구조적 리스크 —
> **레거시 미디어 ~38GB vs Supabase Free Storage 1GB** — 를 의사결정 가능한 선택지로 정리한다.
> 이 문서는 "월 0원" 운영 목표를 지키면서 38GB를 어떻게 다룰지에 대한 **기술 스코핑**이며,
> 최종 결정(예산 투입 여부·이관 범위)은 이해관계자 몫이다.
> 관련: [serverless_vs_selfhosted.md](serverless_vs_selfhosted.md) §0(이미지 한도가 첫 천장), [migration_plan.md](../plans/migration_plan.md) §3(파일: 1GB 초과 시 R2 병행 검토)

## 1. 문제 정의

> **용량 전제 주의**: "38GB"는 2026-04 1차 분석의 **추정치이며, 6월 재분석에서 철회되어 현재 미디어 총량은 미측정**이다(분석 리포트 4.1). 즉 실제 용량은 38GB보다 크거나 작을 수 있다. **그래서 어떤 스토리지 결정보다 §2의 실측 감사가 문자 그대로 첫 단계**다. 이 문서는 "무료 1GB를 크게 넘는 규모"라는 보수적 가정 하에 선택지를 정리한다.

신규 스택의 **가장 먼저 닿는 천장은 트래픽이 아니라 미디어 용량**이다 (회원 300명·동접 수십 명 규모에서 함수 호출·DB 연결·대역폭은 모두 한도의 10% 미만). Supabase Free의 미디어 관련 한도:

| 한도 | Free | 비고 |
|---|---|---|
| Storage 용량 | **1GB** | 레거시 미디어가 수 GB만 돼도 초과 |
| 월 egress(전송량) | **5GB/월** | 사진 트래픽 몰리면 1일에도 소진 가능 |
| 이미지 변환(transform) | 월 100장(origin) | 썸네일 온더플라이 변환 시 부족 |

**두 가지를 분리해서 봐야 한다:**
- **(A) 저장 용량 38GB** — 한 번 넣으면 끝나는 정적 문제. 돈이나 외부 스토리지로 해결.
- **(B) 월 egress 5GB** — 매달 반복되는 흐름 문제. 사진 게시판을 활발히 보면 **A보다 먼저 터진다.** 이게 진짜 위험.

> egress가 핵심인 이유: 1GB 사진첩을 회원 50명이 한 달에 한 번씩만 봐도 50GB — Free egress의 10배다. 용량을 외부로 빼더라도 **전송이 무료인 스토리지**가 아니면 매달 요금이 발생한다.

## 2. "38GB를 정말 다 옮겨야 하는가" — 범위 축소 먼저

38GB는 XE `files/` 디렉터리 **원본 그대로**의 수치로 추정된다. 실제 보존 대상은 훨씬 작을 가능성이 높다. **이관 전 감사(audit)로 범위를 줄이는 것이 어떤 스토리지 선택보다 효과가 크다.**

| 축소 레버 | 근거 | 기대 효과 |
|---|---|---|
| **썸네일 제외** | XE는 `files/thumbnails/`를 원본과 별도 저장 — 신규 스택은 온더플라이/빌드타임 생성 | 원본의 20~40% 차지하는 경우 많음 |
| **원본 리사이즈** | 2010년대 폰 사진 다수가 3~8MB 풀해상도. 장변 1600px 재인코딩 시 장당 200~500KB | **전체 용량 50~80% 절감** (가장 큰 레버) |
| **휴면·빈 게시판 제외** | 33개 중 운영 안 되는 게시판의 첨부는 지연 이관 또는 아카이브 | 게시판 정리(별도 과업)와 연동 |
| **중복 제거** | XE는 같은 파일 재첨부 시 물리 복제. 해시 dedup | 가변(수 % ~ 수십 %) |
| **비이미지 첨부 분리** | hwp/pdf/zip 등은 egress가 드물어 별도 취급 가능 | 트래픽 위험에서 분리 |

**목표 시나리오**: 감사 + 리사이즈 + 썸네일 제외로 실보존 미디어를 **10GB 이하**로 떨어뜨릴 수 있다면, 아래 선택지 대부분이 **무료 티어 안**에 들어온다. → 먼저 해야 할 것은 스토리지 결정이 아니라 **`xe_files` 실측 감사**다.

> 이미 채택된 운영 정책(클라이언트 리사이즈 장변 1600px 업로드)은 **신규 업로드**에만 적용된다. 레거시 38GB는 ETL 단계에서 **일괄 리사이즈**를 한 번 더 태워야 같은 효과를 본다.

## 3. 스토리지 선택지 비교

전송량(egress) 무료 여부를 1순위로 본다. 가격은 2026-06 기준.

| 옵션 | 저장 단가 | egress | 무료 한도 | 월 비용(실보존 28GB 가정¹) | 평가 |
|---|---|---|---|---|---|
| **A. Supabase Free 유지** | — | — | 1GB / 5GB월 | $0 (불가능) | 수 GB도 불수용. **탈락** |
| **B. Cloudflare R2** | $0.015/GB월 | **$0 (무료)** | **10GB 저장** + 1M/10M ops | **~$0.27**, 10GB↓면 **$0** | ★ egress 무료가 결정적 |
| **C. Backblaze B2** | $0.006/GB월 | 3×저장까지 무료, 이후 $0.01/GB | 10GB 저장 | ~$0.11 + egress 변수 | 저장 최저가, egress 조건부 |
| **D. Supabase Pro** | $0.021/GB월(100GB 포함) | $0.09/GB(250GB 포함) | Pro에 포함 | **$25 고정** + 초과분 | 통합 편하나 월 0원 포기 |
| **E. Vercel Blob** | $0.023/GB월 | $0.05/GB | Hobby 소량 | 변동, 통합 쉬움 | egress 유료라 사진엔 불리 |

¹ 실보존 용량은 §2 감사 전까지 미정. 위 28GB는 "무료 1GB를 크게 넘되 감사·리사이즈 후 남는 양"을 보수적으로 가정한 예시일 뿐이다. R2 무료 10GB 차감 → 18GB 과금 기준 ~$0.27. **실보존이 10GB 이하면 B·C는 $0.**

**핵심 비교 B vs D:**
- **R2(B)**: egress 무료가 사진 사이트의 본질 위험(§1-B)을 원천 제거. 저장도 10GB 무료. **월 0원 목표를 거의 유지**(초과해도 푼돈). 단 Supabase와 별도 서비스 = 계정/키 1개 추가, ETL에서 R2로 업로드하는 코드 필요.
- **Supabase Pro(D)**: Storage·egress·DB가 한 콘솔. 운영 단순. 그러나 **$25/월 고정 = 연 33만원**, 그리고 egress 250GB 초과 시 추가 과금이 사진 사이트에선 현실적 위험. "전담 인력 없는 무료 운영" 전제와 충돌.

## 4. 권고안 (단계적)

> 한 번에 결정하지 말고 **감사 → 범위 축소 → 무료 티어 수용 가능성 확인 → 필요 시 R2** 순서.

1. **[선결] `xe_files` 실측 감사** — 총 용량/파일 수/확장자 분포/게시판별 분포/썸네일 비율을 뽑는다. 38GB의 실제 구성을 모르면 어떤 결정도 추정이다. (ETL 준비 작업에 포함)
2. **ETL 일괄 리사이즈 파이프라인** — 이미지 첨부를 장변 1600px·품질 80으로 재인코딩하며 이관. 썸네일 원본은 버리고 신규 스택에서 생성. → 실보존 용량 측정.
3. **결과가 ~10GB 이하면**: **Cloudflare R2 무료 티어**로 전량 수용. **월 0원 유지 + egress 무료**. `/dl/{id}` 프록시가 R2 객체로 리다이렉트(또는 R2 커스텀 도메인 직링크). **← 기본 권고 경로.**
4. **10GB 초과면**: R2 유료(초과분만, 보통 월 $1 미만)로 흡수. 여전히 Supabase Pro($25)보다 압도적으로 싸고 egress가 무료다.
5. **Supabase Pro는 비권장** — 광고/후원 도입 등으로 어차피 유료화가 강제되는 별도 트리거(serverless 문서 §6-3)가 발동할 때 재검토.

**요약 한 줄**: *감사·리사이즈로 용량을 줄이고, 남는 미디어는 Cloudflare R2(egress 무료, 10GB 무료)에 둔다. 이 경로면 38GB 문제를 월 0원에 가깝게 해소하며, 무료 운영 원칙을 깨지 않는다.*

## 5. R2 채택 시 구현 영향 (상세)

> **핵심 경계**: R2는 **파일 바이트(blob) 저장소만** 대체한다. Auth·DB(`posts`/`comments`/`attachments` 행)·권한 판정(`can_read_board` RLS)은 **전부 Supabase에 그대로** 남는다. "어떤 파일이 어느 글 소속이고 누가 볼 수 있는지"는 계속 Postgres가 알고, R2는 키→바이트만 들고 있다. **R2는 우리 RLS를 모른다** — 이것이 모든 변경의 근본 원인이다.

### 5.1 변경 범위 한눈에

| 레이어 | 현재(Supabase) | R2 도입 후 |
|---|---|---|
| Auth(로그인/세션) | Supabase Auth | **그대로** |
| DB(`attachments` 행 등) | Supabase Postgres | **그대로** |
| 권한 판정(RLS `can_read_board`) | Supabase RLS | **그대로**(테이블 RLS로 판정) |
| **파일 바이트** | Supabase Storage `attachments` 버킷 | **R2 버킷** |
| storage 객체 RLS(`storage.objects` 정책) | 인증·경로·권한 강제 | **R2엔 무력** → 앱+테이블 RLS로만 강제 |

**버킷 분리 권장**: avatars(프로필)·site(슬라이드) 버킷은 용량이 작아 무료 1GB 안에 들어온다 → **Supabase Storage에 그대로 두고, 무거운 게시판 첨부 + 레거시 미디어만 R2로** 보낸다. R2는 "이미지 전용"이 아니라 "무거운 첨부 전용" 저장소.

### 5.2 코드 변경 — Supabase Storage SDK 직접 호출 3곳 + 추상화

현재 Storage SDK를 직접 부르는 지점은 정확히 3곳. **권한 로직은 그대로**, 마지막 "바이트 주고받기" 호출만 교체된다.

| # | 위치 | 현재 | R2 도입 후 |
|---|---|---|---|
| ① 업로드 | `components/attachment-field.tsx:113` `supabase.storage.upload()` | 브라우저가 사용자 JWT로 직접 업로드, storage RLS가 인증·경로 강제 | R2엔 JWT/RLS 없음 → **서버액션이 R2 presigned PUT URL 발급** → 브라우저가 그 URL로 직접 PUT. (Vercel 함수로 바이트 우회 시 Hobby 4.5MB 바디 한도·egress 낭비 → presigned가 정석) |
| ② 다운로드 | `app/dl/[id]/route.ts:21` `createSignedUrl()` | 첨부 행 RLS 조회(권한확인) → Supabase 서명 URL → 302 | **권한확인 단계 그대로**(행이 Postgres에 있으니 동작). 마지막 줄만 **R2 presigned GET URL** 생성 후 302. 공개 게시판 이미지는 R2 커스텀 도메인 직링크(서명 없이 CDN 캐시) |
| ③ 삭제 | `attachment-field.tsx:140`, `app/boards/[slug]/actions.ts`(updatePost 첨부 제거) `storage.remove()` | Supabase Storage 삭제 | S3 `DeleteObjectCommand` |

- **클라 리사이즈(`maybeResize`, `attachment-field.tsx:16`)는 저장소 무관 → 그대로 유지.**
- **추상화 신설 `lib/storage.ts`(권장)**: put/getPresigned/delete를 한 모듈로 감싸 S3 SDK 호출이 코드 전반에 흩어지지 않게. 향후 R2↔Supabase↔자체 재이전 비용을 낮춘다(이식성 원칙).
- **신규 의존성**: `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` (R2가 S3 호환).
- **DB 스키마 변경 없음**: `attachments.storage_path`에 R2 객체 키를 그대로 저장(컬럼 의미만 "버킷 내 키" → "R2 키"로 해석 변경). 마이그레이션 중 Supabase↔R2 혼재 시 `storage_provider` 식별 컬럼을 둘지는 ETL 전략에서 결정.

### 5.3 CI/CD 변경

- **버킷이 더 이상 SQL 마이그레이션으로 생성되지 않음** ⚠️ — 현재 `supabase/migrations/*.sql`이 `storage.buckets` + storage RLS까지 코드로 만든다(스키마=코드 원칙, CLAUDE.md #2). **R2 버킷·CORS·수명주기는 Postgres 밖**이라 Cloudflare에서 `wrangler`/Terraform 또는 콘솔 1회 생성. → 이 부분만 "코드가 단일 진실" 원칙에 구멍이 생기므로 **`wrangler.toml` 또는 IaC 파일을 repo에 두어 보완**(권장).
- **storage RLS 정책(`attachments_read`/`attachments_insert` on `storage.objects`)이 R2 객체엔 무력** → drop 또는 avatars용으로만 잔존. 권한은 앱 + `attachments` 테이블 RLS로 일원화.
- **`supabase db push` GitHub Action은 그대로** — Postgres만 다루므로 R2와 무관(변경 없음).
- **신규 시크릿**: `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` / `R2_PUBLIC_BASE`(커스텀 도메인). → Vercel 환경변수 + `.env.local.example`에 추가(값은 커밋 금지).
- **백업 잡 추가**: pg_dump는 Postgres만 → R2는 `rclone`로 주기 백업하는 별도 Action 권장(현재 Supabase Storage도 미백업이라 어느 쪽이든 신규 고려사항).
- **ETL(1회) 잡**: 레거시 미디어 → 리사이즈 → R2 일괄 업로드 스크립트가 위 R2 시크릿을 사용(로컬 또는 전용 Action).

### 5.4 인프라 변경

- **외부 서비스 1개 추가**: Cloudflare 계정 + R2 버킷 + (공개자산용) 커스텀 도메인. S3 호환 엔드포인트 `https://<account>.r2.cloudflarestorage.com`.
- **R2 버킷 CORS 규칙** 1회 설정 — 브라우저 presigned PUT을 위해 우리 오리진 허용.
- **리전 고정 불필요** — R2는 글로벌·egress 무료라 `icn1` 같은 리전 핀이 없다. DB↔함수 `icn1` 정렬(CLAUDE.md #7)은 영향 없음.
- **이미지 변환**: Supabase image transform(월 100장 한도)에 의존하지 않음 — 업로드 시점 리사이즈(이미 채택) + R2 직서빙으로 변환 한도 회피.
- **이식성 유지**: R2는 S3 호환 → `pg_dump`(DB) + `rclone`(객체) 조합으로 여전히 탈출 가능. 단 벤더 2개·키 2세트로 인수인계 복잡도가 소폭 증가(§6 결정항목 4와 직결).

### 5.5 구현 체크리스트 (R2 확정 시)

- [ ] Cloudflare R2 버킷 생성 + CORS + (공개용) 커스텀 도메인 — `wrangler.toml`로 코드화
- [ ] `lib/storage.ts` 추상화(put/presigned-get/delete) + `@aws-sdk/*` 추가
- [ ] `attachment-field.tsx` 업로드를 presigned PUT으로 전환
- [ ] `/dl/[id]` 다운로드를 R2 presigned GET(공개는 직링크)으로 전환
- [ ] `actions.ts`/`attachment-field.tsx` 삭제를 S3 Delete로 전환
- [ ] storage RLS 정책 정리(R2 이전분 drop, avatars 잔존 결정)
- [ ] Vercel 환경변수 + `.env.local.example` 갱신, R2 백업 Action 추가
- [ ] ETL 일괄 리사이즈→R2 업로드 + `attachments.storage_path` 매핑 검증

## 6. 이해관계자 결정 대기 항목

기술 선택과 별개로 **사람의 결정이 필요한** 질문:

- [ ] **레거시 사진 보존 범위** — 전체 보존인가, 최근 N년/활성 게시판만인가? (휴면 게시판 정리 정책과 연동)
- [ ] **원본 화질 손실 허용** — 리사이즈(장변 1600px)로 인한 원본 화질 저하를 허용하는가, 일부 게시판(졸업앨범 등)은 원본 보존이 필요한가?
- [ ] **월 0원 vs 운영 단순성** — 미디어 용량이 무료 티어를 넘길 때, 월 $1 미만의 R2 과금을 감수할 것인가(권고) vs 범위를 더 줄여 강제로 무료에 맞출 것인가?
- [ ] **외부 서비스 1개 추가 허용** — R2 계정/키를 운영 스택에 추가하는 것이 인수인계 관점에서 수용 가능한가? (Supabase Pro 통합이 더 단순하나 $25/월)

## 출처

- Cloudflare R2: [Pricing](https://developers.cloudflare.com/r2/pricing/) (저장 $0.015/GB월, **egress $0**, 무료 10GB + 1M Class A / 10M Class B ops)
- Backblaze B2: [Pricing](https://www.backblaze.com/cloud-storage/pricing) (저장 $0.006/GB월, 무료 egress 3×저장)
- Supabase: [Pricing](https://supabase.com/pricing) (Free 1GB/5GB egress, Pro $25 — 100GB 저장·250GB egress 포함, 초과 저장 $0.021/GB·egress $0.09/GB), [Storage 이미지 변환](https://supabase.com/docs/guides/storage/serving/image-transformations)
- 신규 업로드 리사이즈 정책: CLAUDE.md 기술원칙 §8, [migration_plan.md](../plans/migration_plan.md) §3
