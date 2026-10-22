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
];
