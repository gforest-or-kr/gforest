// 설문 레지스트리 — slug 하나 = 설문 하나. 응답 화면 /portal/survey/<slug>, 관리자 /portal-admin/survey/<slug>,
// DB survey_responses.survey_key = slug. 새 설문은 lib/survey/<slug>/ 에 문항 데이터 파일을 만들고 여기 한 줄을 더한다(PR).
// 순수 데이터 모듈 — 클라이언트(작성 화면)에서도 import 한다. 서버 전용 코드를 넣지 말 것.
// slug 규칙: <연도>-<주제>, 소문자·숫자·하이픈(쿠키 이름·URL·CSV 파일명에 그대로 쓴다).
import { QUESTIONS, RESPONDENT_ROLES, SECTIONS } from "./2026-website/questions";
import type { Question, RespondentRole, Section } from "./types";

export interface SurveyDef {
  slug: string;
  title: string;
  sections: readonly Section[];
  roles: readonly RespondentRole[];
  questions: readonly Question[];
}

const SURVEYS: readonly SurveyDef[] = [
  {
    slug: "2026-website",
    title: "새 홈페이지 이해관계자 의견 조사",
    sections: SECTIONS,
    roles: RESPONDENT_ROLES,
    questions: QUESTIONS,
  },
];

export function getSurvey(slug: string): SurveyDef | null {
  return SURVEYS.find((s) => s.slug === slug) ?? null;
}
