# gforest.or.kr 기존 사이트 구조 분석 (2026-06-10)

> 1차: 익명 GET 기반 공개 구조 조사. 2차: 일반회원 로그인 세션으로 추가 조사 (cmux 브라우저).
> **2차 조사에서 회원 전용 메뉴 3개(커뮤니티/학부모｜학생/운영위｜교사)와 게시판 25개가 추가 발견됨. 권한 모델은 4단계 이상의 계층 구조.**

## 사이트맵

XE 단축 URL(`/xe/<mid>`) 사용. 최상위 메뉴 2개(학교소개/학교소식) + 회원가입 버튼.

```
푸른숲발도르프학교 (메인)  https://gforest.or.kr/xe/

├─ 학교소개
│  ├─ 교육이념 및 학교·교사소개   /xe/page_QziY51   [페이지]
│  ├─ 교육과정                    /xe/page_XUIF39   [페이지]
│  │   ├─ 푸른숲의 흐름           /xe/page_XUIF39
│  │   ├─ 발도르프 교육이란?      /xe/page_GDgR99
│  │   ├─ 통합교육이란?           /xe/page_AKQA33
│  │   ├─ 담임과정                /xe/page_Dxqj69
│  │   ├─ 상급과정                /xe/page_jGvM81
│  │   ├─ 시간표                  /xe/page_LItK60
│  │   ├─ 방과후활동              /xe/page_gkHt66
│  │   └─ FAQ                     /xe/page_vxdb95
│  ├─ 조직 및 운영                /xe/page_sLEF80   [페이지]
│  ├─ History                     /xe/page_wVHN38   [페이지]
│  ├─ 전형안내                    /xe/page_GUId37   [페이지]
│  │   ├─ 신편입학                /xe/page_GUId37
│  │   └─ 신편입학 Q&A            /xe/board_QNA     [게시판]
│  └─ 오시는길                    /xe/page_wqQs37   [페이지]
│
├─ 학교소식
│  ├─ 알려드립니다                /xe/board_noti     [게시판]
│  ├─ 학교일정표                  /xe/board_cal      [캘린더형 게시판]
│  ├─ 학교이야기                  /xe/board_story    [게시판]
│  ├─ 교류게시판                  /xe/board_chg      [게시판]
│  ├─ 정보｜강좌｜좋은글          /xe/board_info     [게시판]
│  ├─ 교육자료실                  /xe/board_eduData1 [게시판]
│  └─ 살림살이                    /xe/board_budset   [게시판]
│
└─ 회원가입  /xe/index.php?mid=page_JbDV85&act=dispMemberSignUpForm
```

기타 발견:

- `page_avdZ06` — 메인 배너 "내용보기" 링크 (메뉴 미노출 페이지)
- `page_JbDV85` — 캘린더 위젯·회원 모듈(로그인/가입 act)이 걸린 mid
- `board_UAoo82` — 메인 배너 "편입학 Q&A" 링크인데 **404 죽은 링크** (실제 게시판은 `board_QNA`) → 리뉴얼 시 정리 대상

## 회원 전용 메뉴 (로그인 후 노출 — 2차 조사)

익명에게는 메뉴 자체가 숨겨져 있던 영역. 일반회원(학부모) 세션으로 확인:

```
├─ 전체보기                       /xe/hot_2024       [일반회원도 접근 불가]
├─ 커뮤니티
│  ├─ 자유게시판                  /xe/board_free
│  ├─ 동호회                      /xe/board_circle
│  ├─ 벼룩시장｜부동산            /xe/board_market
│  ├─ 도서관                      /xe/board_lib
│  ├─ 방과후 수업                 /xe/after_school
│  │   ├─ 방과후 돌봄수업         /xe/board_after
│  │   ├─ 방과후 악기수업         /xe/board_Instruments
│  │   ├─ 푸른숲오케스트라        /xe/board_Orche
│  │   └─ 중학년 방과후           /xe/board_Xuvv80
│  ├─ 푸른숲사진첩                /xe/board_album2   [갤러리형]
│  └─ 발도르프관련사이트          /xe/board_XoXa54
├─ 학부모｜학생
│  ├─ 학부모게시판                /xe/board_parent
│  ├─ 학부모자료실                /xe/board_Pdata
│  ├─ 학부모 교육 자료모음        /xe/board_edudata
│  ├─ 진로탐색자료실              /xe/board_jinro
│  ├─ 회의록                      /xe/board_rec
│  └─ 학생게시판                  /xe/board_std      [일반회원 접근 불가 — 학생 그룹 전용 추정]
└─ 운영위｜교사
   ├─ 운영위원회                  /xe/board_op1      [일반회원 접근 불가]
   ├─ 교사회                      /xe/board_teacher1 [일반회원 접근 불가]
   │   ├─ 너른방                  /xe/board_Tnurun1  [접근 불가]
   │   ├─ 회의록                  /xe/board_Trec1    [접근 불가]
   │   ├─ 안건방                  /xe/board_LCwm52   [접근 불가]
   │   └─ 교사회자료실            /xe/board_Tdata    [접근 불가]
   ├─ 학부모회                    /xe/board_kPes34
   ├─ 요청게시판
   │   ├─ 운영위에게              /xe/board_toOp1
   │   └─ 학부모회에게            /xe/board_Mcow16
   ├─ 품의서                      /xe/board_pum
   ├─ 공간사용예약                /xe/board_rsv
   ├─ 등업게시판                  /xe/board_grade
   ├─ 홈피제안/오류신고           /xe/board_bug
   └─ 열음자리 뚝딱이             /xe/new_build
```

## 게시판 권한 모델 (수정됨)

~~모든 게시판 공개 읽기~~ → **최소 4단계 권한 그룹이 존재하는 계층 구조**:

| 권한 그룹 | 읽기 가능 범위 |
|---|---|
| 익명(비회원) | 공개 게시판 8개 (학교소개/학교소식 영역) — 글·댓글 쓰기 불가 |
| 일반회원(학부모) | + 커뮤니티·학부모·요청·품의·예약 등 약 23개 게시판 |
| 운영위 | + 운영위원회(board_op1) 등 (추정 — 관리자 확인 필요) |
| 교사 | + 교사회 5개 게시판 (추정) |
| 학생 | 학생게시판(board_std) (추정) |

- 일반회원 세션 fetch 결과: `board_op1`, `board_teacher1`, `board_Tnurun1`, `board_Trec1`, `board_LCwm52`, `board_Tdata`, `board_std`, `hot_2024` → "권한이 없습니다" (denied)
- **등업게시판(board_grade)의 존재** → 가입 후 관리자가 그룹을 수동 승급하는 운영 방식
- 공개 게시판의 본문 페이지 "권한이 없습니다" 문구는 댓글 쓰기 권한 안내(`cmt_disable bd_login`)이며 본문 잠금이 아님 (1차 조사 결론 유지)
- **정확한 그룹↔게시판 매핑은 XE 관리자 페이지에서 확인 필요** (xe_member_group / 게시판별 권한 설정)

## 로그인 / 회원가입

- 로그인: `/xe/index.php?mid=page_JbDV85&act=dispMemberLoginForm` (필드 `user_id`/`password`)
- 회원가입: `/xe/index.php?mid=page_JbDV85&act=dispMemberSignUpForm` (표준 XE member 모듈)

## 기술 스택 확인

- XpressEngine 1.x (`<meta name="Generator" content="XpressEngine">`)
- 레이아웃: ksodesign `layouts/KSO_flatScroll/` (Bootstrap 3, parallax/Camera 슬라이더, IE8 fallback)
- 에디터: CKEditor (`xpresseditor`, 스킨 `ckeditor_light`)
- 첨부: XE file 모듈 — `files/attach/...`, 썸네일 `files/thumbnails/...` (익명 접근 가능)
- 서버: nginx, PHPSESSID 세션, 모바일 전용 마크업(`mobile-nav`) 별도 존재
- robots.txt: 전체 허용 / sitemap.xml 없음 / RSS(`/xe/rss`)·Atom(`/xe/atom`) 제공

## 화면 타입 (신규 설계 스코핑)

8개 핵심 템플릿으로 전체 커버:

1. 메인 (슬라이더 + 최신글 위젯 + 일정 캘린더 위젯)
2. 정적 페이지 (page 모듈 약 13개 공통)
3. 게시판 목록
4. 게시판 본문 읽기 (댓글 포함)
5. 게시판 글쓰기/수정 (에디터, 로그인 필요)
6. 캘린더 (월/주 보기)
7. 로그인
8. 회원가입

## 시사점 (2차 조사 반영)

- **게시판 총 ~33개** (공개 8 + 회원 ~25). 단, 화면 템플릿 종류는 동일 — 게시판 수가 늘어도 개발량은 크게 증가하지 않음 (갤러리형 사진첩 1종 추가 검토)
- **RLS 설계가 처음 가정보다 복잡**: 게시판별 읽기 권한 그룹(익명/일반회원/운영위/교사/학생)을 데이터로 관리해야 함 — `boards.read_role`, `profiles.role` 기반 정책 필요
- **등업(그룹 승급) 워크플로** 재현 필요: 가입 → 등업게시판 신청 → 관리자 승급
- 공개 영역은 로그인 없이 캡처 가능, 회원 영역은 일반회원 계정으로 캡처 가능, **운영위·교사 영역은 해당 권한 계정 또는 관리자 확인 필요**
- 크롤링 백업도 권한별 계정이 있어야 전체 콘텐츠 확보 가능 → DB 덤프의 중요성이 더 커짐
- 첨부파일 경로 직접 노출(공개 게시판) → 부분적 크롤링 백업 가능
- 캘린더(학교일정표) + 공간사용예약(board_rsv) — 예약/일정성 기능 2종의 재현 방식이 설계 포인트
