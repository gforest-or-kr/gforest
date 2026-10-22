import { cookies } from "next/headers";
import { formatKst, surveyClosedNow } from "@/lib/survey/config";
import { BID_COOKIE } from "@/lib/survey/hash";
import { ClosedPaper } from "./_components/papers";
import { SurveyApp } from "./_components/survey-app";

// 요청 시점 렌더(마감·제출 쿠키는 요청마다 다르다). 빌드 시점에 DB·SURVEY_* env 를 읽지 않는다.
export const dynamic = "force-dynamic";

// 첫 화면은 서버가 정한다(깜박임 없음): 마감 → 마감 안내 / 이 기기 제출 쿠키 → 재방문 안내 / 그 외 → 작성.
export default async function SurveyPage() {
  const { closed, closesAt } = surveyClosedNow();
  if (closed) {
    return (
      <main className="svy-frame">
        <ClosedPaper closedAtLabel={formatKst(closesAt.ms)} notSubmitted={false} />
      </main>
    );
  }
  const submittedHere = (await cookies()).has(BID_COOKIE);
  return (
    <main className="svy-frame">
      <SurveyApp initialView={submittedHere ? "revisit" : "form"} />
    </main>
  );
}
