// 질의서 1~4절(Q1–Q14) 문항 정의. 조립·규칙 설명은 questions.ts 머리 주석 참조.
// 문구는 원본을 그대로 옮긴다(마크다운 굵게·체크 칸·밑줄 빈칸만 제거, 보기 뒤 괄호 속 빈칸은 blank 로 분리).
import { BOARDS_Q1, MEMBER_GROUPS_Q4 } from "./questions-tables";
import type { Question } from "./types";

export const QUESTIONS_PART1: readonly Question[] = [
  // ---- 1. 게시판 정리 ----
  {
    id: "q1",
    no: 1,
    section: 1,
    title: "아래 게시판들을 새 홈페이지로 옮긴 뒤, 유지할지·다른 게시판과 합칠지·없앨지 표시해 주세요.",
    lead: [
      "현재 홈페이지에는 운영위·교사 전용처럼 특정 권한이 있어야 볼 수 있는 것과 사용 빈도가 매우 낮은 것을 포함해 총 45개의 게시판이 있습니다. 이 중 불필요하다고 판단되는 일부는 통합하거나 없애는 쪽을 검토해 볼 수 있을 것 같아 의견을 듣고 싶습니다. 특정 권한이 있어야 볼 수 있는 게시판은 실제로 이용하시는 분만 표시해 주세요(다른 분은 비워 두셔도 됩니다). 글 수·최근 글은 2026-10-08 기준으로 다시 확인했습니다(그 밖의 정보는 2026-09-21 기준 유지, 제한적 현행화).",
    ],
    items: [
      { type: "boards", key: "boards", rows: [...BOARDS_Q1] },
      {
        type: "note",
        text: "이 밖에 가족앨범·홈피작업게시판·기능확인·교사초빙·01인터뷰 프로젝트·인터뷰요청 및 의견·20주년 기념페이지(7개)는 활동이 없거나 일회성·내부 테스트 용도라 관리자 전용 보관을 기본값으로 두고 표에서 뺐고, 등업게시판은 새 가입 승인 절차로 대체되어 기존 글만 보관용 게시판으로 옮기기로 이미 정해져 있습니다.",
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q2",
    no: 2,
    section: 1,
    title: "\"방과후활동\" 소개 페이지에 비용·일정·신청 방법을 공개하는 방안, 어떻게 생각하시나요?",
    lead: [
      "지금은 비용·일정·신청 방법 안내가 없어 전화 문의로만 확인할 수 있습니다. 누구나 보는 소개 페이지에 이 정보까지 실어 두면 문의 응대 부담도 줄고, 찾아보시는 분들도 더 편하실 것 같습니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의(전체 공개)" },
          { key: "o2", label: "일부만 공개", blank: { label: "공개 범위:" } },
          { key: "o3", label: "반대(비공개 유지)" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q3",
    no: 3,
    section: 1,
    title: "교류게시판에 외부 단체(출판사·연구기관 등)가 계속 글을 올리도록 허용할까요?",
    lead: ["현재: 외부 단체 게시를 허용하고 있습니다."],
    items: [
      {
        type: "single",
        key: "external",
        title: "외부 단체 게시",
        options: [
          { key: "o1", label: "허용 유지" },
          { key: "o2", label: "제한 또는 폐지" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "layout",
        title: "게시판 구성",
        options: [
          { key: "o1", label: "지금처럼 한 게시판 유지" },
          { key: "o2", label: "외부 정보와 내부 소통 게시판을 나누는 것이 좋음" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },

  // ---- 2. 회원 그룹과 열람 권한 ----
  {
    id: "q4",
    no: 4,
    section: 2,
    title: "회원 그룹을 지금처럼 각각 구분해서 유지하는 방안, 어떻게 생각하시나요?",
    lead: [
      "지금 홈페이지는 회원이 13개 그룹으로 나뉘어 있고, 게시판마다 어떤 그룹이 읽고 쓸 수 있는지 하나씩 따로 정해져 있습니다. 예를 들어 \"운영위원회\" 게시판은 운영위원만, \"품의서\"는 운영위원·교사·행정실만, \"학부모회에게\"는 학부모회만 볼 수 있습니다. 지금 권한이 같아 보이는 그룹이라도 나중에 게시판별로 접근 범위가 달라질 수 있습니다. 그래서 그룹을 몇 개로 억지로 합치기보다 지금처럼 각각 구분해서 관리하는 게 어떨까 싶습니다.",
    ],
    items: [
      {
        type: "leader-list",
        head: ["지금의 회원 그룹", "회원 수 (2026-06-26 기준)"],
        unit: "명",
        rows: [...MEMBER_GROUPS_Q4],
      },
      {
        type: "single",
        key: "groups",
        options: [
          { key: "o1", label: "동의" },
          { key: "o2", label: "반대(더 단순하게 정리하면 좋겠음)", blank: { label: "의견:" } },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "dormant",
        title: "오랫동안 접속하지 않은 회원(OB 등)의 계정을 남겨 두는 것에 대해",
        options: [
          { key: "o1", label: "열람이 필요함" },
          { key: "o2", label: "필요 없음" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "pureum_group",
        title: "\"푸른숲학교\" 그룹(속한 회원 0명)의 용도와 처리",
        options: [
          { key: "o1", label: "그대로 둠(현재 소속 회원 없음)" },
          { key: "o2", label: "그룹 정리" },
          { key: "o3", label: "모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q5",
    no: 5,
    section: 2,
    title: "아래 두 게시판의 용도가 기억나시면 적어 주시고, 새 홈페이지에서 어떻게 처리할지 표시해 주세요.",
    items: [
      {
        type: "note",
        tone: "warn",
        text: "개인정보가 들어 있을 수 있어, \"회원에게 공개\"를 고르시기 전에 내용 확인이 필요합니다.",
      },
      {
        type: "cards",
        key: "cards",
        cards: [
          {
            key: "c1",
            name: "문의사항",
            meta: "만든 날 2022-09-01 · 글 3건 · 2023.05.12",
            purposeLabel: "용도 (기억나시면)",
            options: [
              { key: "o1", label: "관리자만 보관(기본)" },
              { key: "o2", label: "회원에게 공개", blank: { label: "대상:" } },
              { key: "o3", label: "폐기" },
              { key: "o4", label: "모름" },
            ],
          },
          {
            key: "c2",
            name: "편입학설명회 신청서",
            meta: "만든 날 2018-08-29 · 글 65건 · 2018.10.06",
            purposeLabel: "용도 (기억나시면)",
            options: [
              { key: "o1", label: "관리자만 보관(기본)" },
              { key: "o2", label: "회원에게 공개", blank: { label: "대상:" } },
              { key: "o3", label: "폐기" },
              { key: "o4", label: "모름" },
            ],
          },
        ],
      },
    ],
  },

  // ---- 3. 자료 이관과 회원 계정 ----
  {
    id: "q6",
    no: 6,
    section: 3,
    title: "기존 글·사진·첨부파일을 새 홈페이지로 옮기는 범위에 대해 의견을 들려주세요.",
    lead: [
      "첨부파일 전체 용량은 약 20GB입니다. 운영 환경(실제 서비스)에는 아직 첨부가 옮겨진 적이 없어, 전체를 옮길 때 실제로 걸리는 시간·비용은 확인되지 않았습니다.",
    ],
    items: [
      {
        type: "single",
        key: "attachments",
        title: "첨부파일 전부를 옮기는 방안(교직원 기록물과 같은 기준), 어떻게 생각하시나요?",
        options: [
          { key: "o1", label: "동의(전부)" },
          { key: "o2", label: "최근 ＿＿년 이내만", blank: { label: "몇 년:", post: "년 이내", num: true } },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "unpublished",
        title: "공개되지 않은 글(비밀글·임시저장 글)은 옮기지 않기로 정해져 있습니다",
        options: [
          { key: "o1", label: "이의 없음" },
          { key: "o2", label: "옮겨야 하는 글이 있음", blank: { label: "내용:" } },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "staff_records",
        title: "교직원 기록물(회의록·안건 등)은 연도 제한 없이 옮겨집니다",
        options: [
          { key: "o1", label: "이의 없음" },
          { key: "o2", label: "보존 연수 제한이 필요함", blank: { label: "몇 년:", post: "년치", num: true } },
          { key: "o3", label: "교사회 논의 필요" },
        ],
      },
      {
        type: "single",
        key: "requisitions",
        title: "품의서 본문·첨부를 옮기는 범위",
        options: [
          { key: "o1", label: "전 기간 전체" },
          { key: "o2", label: "최근 ＿＿년 이내만", blank: { label: "몇 년:", post: "년 이내", num: true } },
          { key: "o3", label: "본문만(첨부 제외)" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q7",
    no: 7,
    section: 3,
    title: "새로 가입하는 학부모의 자격, 어떤 방식으로 확인하면 좋을까요?",
    lead: [
      "새 홈페이지 설계에서는 가입 신청 후 관리자가 승인해야 회원 게시판을 볼 수 있습니다(승인 전에는 공개 게시판만 열람). 승인할 때 자격을 어떻게 확인하면 좋을지 아래 안들을 포함해 의견을 들려주세요.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "학부모 이름·자녀 이름·학년·연락처 등 가입 정보를 바탕으로 관리자가 수동으로 확인 후 승인" },
          {
            key: "o2",
            label:
              "미리 등록해 둔 학부모 명단과 자동으로 대조해 일치하면 자동 승인(명단을 누가·어떻게 최신 상태로 관리할지가 함께 정해져야 함)",
          },
          { key: "o3", label: "기타 방식", blank: { label: "내용:" } },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q8",
    no: 8,
    section: 3,
    title:
      "품의서 등에는 작성일·청구자·금액·지급 희망일·은행·계좌번호·예금주·학생 이름·보호자·학년이 적힙니다. 새 홈페이지에 어디까지 남기면 좋을까요?",
    lead: [
      "현재 계획: 실제 운영 이관에서는 위 항목을 모두 그대로 보존합니다(시험 이관용으로 계좌번호·예금주 등 5개 항목을 가리는 옵션은 이미 있으나, 실제 이관에는 적용하지 않기로 되어 있습니다).",
    ],
    items: [
      {
        type: "single",
        key: "scope",
        title: "보존 범위",
        options: [
          { key: "o1", label: "그대로 보존" },
          { key: "o2", label: "일부 항목 제외 또는 가림", blank: { label: "항목:" } },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      {
        type: "single",
        key: "retention",
        title: "보존 연한 기준(학교 내규나 법으로 정해진 기준이 있는지)",
        options: [
          { key: "o1", label: "기준 있음", blank: { label: "기준:" } },
          { key: "o2", label: "기준 없음" },
          { key: "o3", label: "확인 필요" },
        ],
      },
      {
        type: "single",
        key: "pre2022",
        title: "2022년 이전 품의서를 옮기는 것",
        options: [
          { key: "o1", label: "필요" },
          { key: "o2", label: "불필요" },
          { key: "o3", label: "규모를 확인한 뒤 결정" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q9",
    no: 9,
    section: 3,
    title: "전환 때 연락이 닿지 않는 회원은 어떻게 처리하면 좋을까요?",
    lead: [
      "전환 후에는 비밀번호를 다시 설정해야 접속할 수 있는데, 오래된 그룹(기본·OB 등)일수록 등록된 이메일이 유효하지 않을 수 있습니다. 전환 사실을 어떤 채널로 알리면 좋을지도 함께 여쭙습니다.",
    ],
    items: [
      {
        type: "single",
        key: "unreachable",
        title: "이메일이 없거나 닿지 않는 회원 처리",
        options: [
          { key: "o1", label: "연락될 때까지 계정 보류" },
          { key: "o2", label: "안내만 하고 별도 조치 없음" },
          { key: "o3", label: "다른 채널(문자·카카오톡 등)로 개별 안내" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      {
        // 원본 제목 끝 "(중복 가능)"은 화면이 다중 선택 제목에 붙이는 "(여러 개 선택 가능)"으로 대신한다
        type: "multi",
        key: "channels",
        title: "전환 사실을 알리는 채널",
        options: [
          { key: "o1", label: "홈페이지 공지" },
          { key: "o2", label: "카카오톡" },
          { key: "o3", label: "밴드" },
          { key: "o4", label: "이메일" },
          { key: "o5", label: "기타", blank: { label: "내용:" } },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },

  // ---- 4. 입학 안내와 외부 홍보 ----
  {
    id: "q10",
    no: 10,
    section: 4,
    title:
      "입학설명회 신청은 지금처럼 외부 폼을 계속 쓰는 방안, 어떻게 생각하시나요? (원서 제출 방식은 이번에 다시 확인하지 못했습니다)",
    lead: ["이미 쓰고 있는 방식이라 구현 부담이 없고, 접수·마감 관리 기능을 새로 만들지 않아도 됩니다."],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의(외부 폼 유지)" },
          {
            key: "o2",
            label: "반대(홈페이지에 신청 폼을 직접 두고 싶음)",
            blank: { label: "원하는 접수 흐름·마감 방침:" },
          },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q11",
    no: 11,
    section: 4,
    title: "입학 문의를 \"자주 묻는 질문 강화 + 문의 폼(담당자가 며칠 안에 회신)\"으로 바꾸는 방안, 어떻게 생각하시나요?",
    lead: [
      "지금은 Q&A 게시판에 글을 올리는 방식인데, 자주 나오는 질문을 미리 정리해 두고 나머지는 문의 폼으로 받으면 응대 부담이 줄고 답변도 더 빨라질 수 있습니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의" },
          { key: "o2", label: "반대(지금의 Q&A 게시판 유지)" },
          { key: "o3", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q12",
    no: 12,
    section: 4,
    title: "학교 유튜브·인스타그램 내용을 새 홈페이지에 어느 정도로 보여주면 좋을까요? (지금은 링크만 있습니다)",
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "링크만 제공 (지금 수준)" },
          { key: "o2", label: "홈페이지 화면 안에 유튜브·인스타그램 내용을 직접 보여주기" },
          { key: "o3", label: "불필요" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
  {
    id: "q13",
    no: 13,
    section: 4,
    title: "입학안내를 상단에 독립 메뉴로 두는 방안, 어떻게 생각하시나요?",
    lead: [
      "현재 계획: 상단 메뉴는 학교소개 / 학교소식 / 커뮤니티 / 학부모·학생 / 운영위·교사 5개이며, 전형안내·오시는길·자주 묻는 질문은 모두 \"학교소개\" 아래에 있습니다. 외부 방문자가 가장 많이 찾는 정보가 전형안내인데 한 단계 더 들어가야 해서, 상단 독립 메뉴로 빼면 어떨까 합니다.",
    ],
    items: [
      {
        type: "single",
        key: "choice",
        options: [
          { key: "o1", label: "동의(입학안내 독립 메뉴)" },
          { key: "o2", label: "반대(지금 계획대로)" },
          { key: "o3", label: "\"오시는길\"도 독립 노출했으면 함" },
          { key: "o4", label: "미정 / 모름" },
        ],
      },
      { type: "textarea", key: "menus", label: "추가로 신설하거나 정리하면 좋을 메뉴가 있으면 적어 주세요" },
    ],
  },
  {
    id: "q14",
    no: 14,
    section: 4,
    title: "지금 홈페이지 주소로 링크가 걸려 있는 곳을 알려 주세요. (주소가 바뀌고 자동 연결 계획은 아직 없습니다)",
    items: [
      {
        type: "textarea",
        key: "links",
        label: "옛 주소로 링크가 걸려 있는 대표적인 곳(홍보 자료·입학 안내문·SNS 소개란·타 기관 링크 등)",
      },
      { type: "textarea", key: "etc", label: "기타 의견:" },
    ],
  },
];
