import { SurveyApp } from "./_components/survey-app";

// 요청 시점 렌더(마감·제출 쿠키는 요청마다 다르다). 빌드 시점에 DB·SURVEY_* env 를 읽지 않는다.
export const dynamic = "force-dynamic";

export default async function SurveyPage() {
  return (
    <main className="svy-frame">
      <SurveyApp initialView="form" />
    </main>
  );
}
