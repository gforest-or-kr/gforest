// 질의서 5~10절(Q15–Q27, 자유 의견) 문항 정의. 조립·규칙 설명은 questions.ts 머리 주석 참조.
// 문구는 원본을 그대로 옮긴다(마크다운 굵게·체크 칸·밑줄 빈칸만 제거, 보기 뒤 괄호 속 빈칸은 blank 로 분리).
// 다중 선택 제목 끝의 원본 "(여러 개 선택 가능)"은 화면이 붙이므로 데이터에서는 뺀다.
import type { Question } from "../types";

export const QUESTIONS_PART2: readonly Question[] = [
  // ---- 5. 공개 정보 ----
  {
    id: "q15",
    no: 15,
    section: 5,
    title:
      "월 수업료(학비)를 홈페이지에 공개하면 좋을까요? (다른 비용 항목은 이미 공개되어 있고 월 수업료만 비공개입니다)",
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "비공개 유지" },
          { key: "o2", label: "공개" },
          { key: "o3", label: "범위·구간만 공개" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q16",
    no: 16,
    section: 5,
    title:
      "검색에는 누구나 볼 수 있는 게시판·소개 페이지만 나오게 하고, 회원 전용 글과 첨부 원본 사진은 검색에서 빼는 방안, 어떻게 생각하시나요? (지금은 모든 글과 사진이 제한 없이 검색에 노출됩니다)",
    lead: [
      "로그인해야 보이는 글이나 아이들 사진이 외부 검색으로 그대로 노출되는 것은 피하는 쪽이 안전하고, 설정만 바꾸면 되어 구현 부담도 적습니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의" },
          { key: "o2", label: "더 좁게 제한하고 싶음", blank: { label: "범위:" } },
          { key: "o3", label: "반대(지금처럼 제한 없이)" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q17",
    no: 17,
    section: 5,
    title:
      "기존 구글 애널리틱스 계정 접근 권한을 받을 수 있는지, 받기 어렵다면 새 계정으로 새로 시작하는 방안, 어떻게 생각하시나요?",
    lead: [
      "지금 홈페이지에는 구글 애널리틱스(GA4)·태그 매니저가 모두 설치되어 있지만(2026-09-21 확인), 저희에게 계정 접근 권한이 공유된 적은 없습니다. 접근 권한을 받기 어려우면 새 홈페이지에는 새 계정으로 새 추적 코드를 심는 방안을 생각하고 있습니다. 그동안 쌓인 방문 기록은 그대로 가져오지 못하지만, 학교 홈페이지 특성상 방문 기록을 면밀히 분석할 정도의 품을 들일 필요는 크지 않아 보입니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "기존 계정 접근 권한을 전달할 수 있음", blank: { label: "담당자:" } },
          { key: "o2", label: "접근이 어려우니 새 계정으로 새로 시작하는 데 동의" },
          { key: "o3", label: "미정 / 담당자 확인 필요" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },

  // ---- 6. 일정과 공유 ----
  {
    id: "q18",
    no: 18,
    section: 6,
    title:
      "학교 일정을 구글 캘린더 등 휴대폰 캘린더에서 구독해서 볼 수 있게 하는 방안, 어떻게 생각하시나요? (현재 계획은 사이트 안 달력만 제공하는 것입니다)",
    lead: [
      "구독 링크(아이캘린더) 하나만 추가하면 되는 방식이라 구현 부담이 크지 않고, 학교 일정이 휴대폰 캘린더에 자동으로 뜹니다. 양쪽 캘린더를 완전히 맞추는(쌍방향 동기화) 것은 손이 더 많이 가 이번에는 포함하지 않았습니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의(구독 링크 제공)" },
          { key: "o2", label: "불필요(사이트 달력만으로 충분)" },
          { key: "o3", label: "양쪽이 서로 맞춰지는 것까지 원함" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q19",
    no: 19,
    section: 6,
    title: "공개 게시판 8곳에 카카오톡 공유 버튼을 추가하는 방안, 어떻게 생각하시나요? (현재 계획은 버튼이 없습니다)",
    lead: ["버튼 하나 추가하는 정도라 구현 부담이 적고, 지금처럼 링크를 직접 복사해 보내는 수고를 줄일 수 있습니다."],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의" },
          { key: "o2", label: "불필요(지금처럼 링크 직접 복사)" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },

  // ---- 7. 디자인과 브랜드 ----
  {
    id: "q20",
    no: 20,
    section: 7,
    title:
      "새 홈페이지의 색상 방향은 어느 쪽이 좋을까요? (현재 계획은 지금의 초록색을 이어받아 더 차분한 톤으로 다듬는 것입니다)",
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "지금의 초록색 계승" },
          { key: "o2", label: "로고·색상 리뉴얼" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q21",
    no: 21,
    section: 7,
    title: "발도르프 교육의 시각 요소(계절·자연·수채화 느낌 등)를 어느 정도 반영하면 좋을까요?",
    items: [
      {
        type: "single",
        key: "degree",
        title: "반영 정도",
        options: [
          { key: "o1", label: "적극 반영" },
          { key: "o2", label: "일부 반영" },
          { key: "o3", label: "최소화(모던·단정)" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "sns",
        title: "인스타그램·블로그 등과 시각적으로 통일하는 것",
        options: [
          { key: "o1", label: "불필요" },
          { key: "o2", label: "맞추면 좋겠음" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q22",
    no: 22,
    section: 7,
    title: "디자인·구성에서 참고하고 싶은 사이트가 있으신가요?",
    items: [
      { type: "text", key: "ref1", label: "참고 사이트 ①" },
      { type: "text", key: "ref2", label: "참고 사이트 ②" },
      { type: "multi", key: "none", options: [{ key: "o1", label: "특별히 없음 / 추천받고 싶음" }] },
    ],
  },

  // ---- 8. 비용 ----
  {
    id: "q23",
    no: 23,
    section: 8,
    title: "새 홈페이지의 운영 예산, 지금과 비슷한 수준이면 될까요?",
    lead: [
      "다음 1년 연장 견적: 연 약 121만원(호스팅 1,188,000원 + 도메인 22,000원). 견적이며, 이번에 실제로 결제한 금액은 확인되지 않았습니다. 새 설계는 매달 드는 비용의 상한을 약 110달러로 잡아 두려고 합니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "지금과 비슷한 수준이면 충분" },
          { key: "o2", label: "줄이고 싶음", blank: { label: "이유:" } },
          { key: "o3", label: "늘릴 계획이 있음", blank: { label: "이유:" } },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
    ],
  },

  // ---- 9. 홈페이지의 역할과 최근 변화 ----
  {
    id: "q24",
    no: 24,
    section: 9,
    title:
      "카카오톡·밴드가 이미 활발한 상황에서, 홈페이지가 꼭 맡아야 할 역할은 무엇이라고 보시나요? (여러 개 선택 가능)",
    items: [
      {
        type: "multi",
        key: "roles",
        options: [
          { key: "o1", label: "공식 기록·보관(검색해서 찾을 수 있는 영구 보관)" },
          { key: "o2", label: "외부(입학을 검토하는 분 등)에게 보여주는 공식 창구" },
          { key: "o3", label: "자료실(문서·첨부 내려받기)" },
          { key: "o4", label: "일정·공지의 단일 기준점" },
          { key: "o5", label: "기타", blank: { label: "내용:" } },
        ],
      },
      {
        type: "single",
        key: "promo",
        title: "외부 대상 홍보(행사·교육 성과·졸업생 진로·언론 등)를 위한 홍보 메뉴·콘텐츠 정비",
        options: [
          { key: "o1", label: "현행 유지로 충분" },
          { key: "o2", label: "정비·신설 필요" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "posting",
        title: "학부모가 볼 수 있는 게시글 수가 전반적으로 줄고 있습니다. 앞으로의 방향",
        options: [
          { key: "o1", label: "현 수준 유지" },
          { key: "o2", label: "게시 활성화 계획 있음" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
    ],
  },
  {
    id: "q25",
    no: 25,
    section: 9,
    title: "품의서 등록이 많이 줄었습니다(특히 2025년부터 크게). 어떤 사정이 있었는지 여쭙고 싶습니다.",
    items: [
      {
        type: "multi",
        key: "background",
        title: "짐작되는 배경",
        options: [
          { key: "o1", label: "행정 절차 변경(구글 폼·별도 시스템으로 이전)" },
          { key: "o2", label: "결재·승인 방식 자체의 변화" },
          { key: "o3", label: "기타", blank: { label: "내용:" } },
          { key: "o4", label: "잘 모르겠음" },
        ],
      },
      {
        type: "single",
        key: "future",
        title: "앞으로의 운영",
        options: [
          { key: "o1", label: "지금 방식 유지" },
          { key: "o2", label: "방식 변경" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
    ],
  },
  {
    id: "q26",
    no: 26,
    section: 9,
    title: "학교이야기 게시판 글이 줄었습니다. 짐작되는 배경을 여쭙고 싶습니다.",
    items: [
      {
        type: "multi",
        key: "background",
        title: "짐작되는 배경",
        options: [
          { key: "o1", label: "담당자 변경·역할 재분담" },
          { key: "o2", label: "인스타그램 등 외부 채널로 사진 공유가 옮겨감" },
          { key: "o3", label: "기타", blank: { label: "내용:" } },
          { key: "o4", label: "잘 모르겠음" },
        ],
      },
      { type: "text", key: "photo_plan", label: "앞으로의 사진 게시 담당과 방식에 대한 의견", skip: true },
    ],
  },
  {
    id: "q27",
    no: 27,
    section: 9,
    title: "교직원·운영위·학생 게시판의 기록 활동이 다른 곳으로 옮겨갔는지 여쭙고 싶습니다.",
    items: [
      {
        type: "multi",
        key: "background",
        title: "활동이 줄어든 배경",
        options: [
          { key: "o1", label: "외부 협업도구(구글 워크스페이스 등)로 이동" },
          { key: "o2", label: "메신저(밴드·카카오톡)로 이동" },
          { key: "o3", label: "해당 회의체·활동 자체의 변화" },
          { key: "o4", label: "기타", blank: { label: "내용:" } },
          { key: "o5", label: "잘 모르겠음" },
        ],
      },
      {
        type: "single",
        key: "minutes",
        title: "회의록을 2025년부터 다른 방식으로 쓰고 계신가요",
        options: [
          { key: "o1", label: "예", blank: { label: "어디에:" } },
          { key: "o2", label: "아니오(홈페이지 유지)" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
    ],
  },

  // ---- 10. 자유 의견 (번호 없음) ----
  {
    id: "free",
    no: null,
    section: 10,
    title: "새 홈페이지에 바라는 점이나 아이디어가 있다면 자유롭게 적어 주세요.",
    lead: [
      "말씀하신 내용을 모두 반영하기는 어렵지만, 여러 분이 공통으로 요청하시는 내용은 진행 상황과 우선순위를 감안해 작업에 반영될 수 있습니다.",
    ],
    items: [{ type: "textarea", key: "text", label: "자유 의견", rows: 6 }],
  },
];
