import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { formatKst, surveyClosedNow } from "@/lib/survey/config";
import { bidCookieName } from "@/lib/survey/hash";
import { getSurvey } from "@/lib/survey/surveys";
import { ClosedPaper } from "../_components/papers";
import { SurveyApp } from "../_components/survey-app";

// 설문 응답 화면. 주소: portal 호스트에선 /survey/<slug>, 그 밖의 호스트에선 /portal/survey/<slug>(proxy.ts rewrite).
// slug 는 lib/survey/surveys.ts 레지스트리에 있는 것만 — 없으면 404.
// 요청 시점 렌더(마감·제출 쿠키는 요청마다 다르다). 빌드 시점에 DB·SURVEY_* env 를 읽지 않는다.
export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const def = getSurvey((await params).slug);
  return def ? { title: def.title } : {};
}

// 첫 화면은 서버가 정한다(깜박임 없음): 마감 → 마감 안내 / 이 기기 제출 쿠키 → 재방문 안내 / 그 외 → 작성(표지).
// 표지의 응답 마감 라벨도 여기서 계산해 넘긴다 — 클라이언트 코드는 env 를 읽지 않는다(설정 없음·해석 불가 → null, 줄 없음).
export default async function SurveyPage({ params }: { params: Params }) {
  const { slug } = await params;
  const def = getSurvey(slug);
  if (!def) notFound();

  const { closed, closesAt } = surveyClosedNow();
  if (closed) {
    return (
      <main className="svy-frame">
        <ClosedPaper closedAtLabel={formatKst(closesAt.ms)} notSubmitted={false} />
      </main>
    );
  }
  const deadlineLabel = closesAt.kind === "set" ? formatKst(closesAt.ms) : null;
  const submittedHere = (await cookies()).has(bidCookieName(def.slug));
  return (
    <main className="svy-frame">
      <SurveyApp slug={def.slug} initialView={submittedHere ? "revisit" : "form"} deadlineLabel={deadlineLabel} />
    </main>
  );
}
