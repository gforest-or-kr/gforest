"use client";

import { useState, useSyncExternalStore } from "react";
import { DRAFT_UNAVAILABLE, readDraftRaw, subscribeDraft } from "./draft";
import { ClosedPaper, CoverPaper, DonePaper, PaperHead, RevisitPaper } from "./papers";
import { SurveyForm } from "./survey-form";

// 질의서 응답 화면(클라이언트). 첫 화면은 서버가 정해 initialView 로 넘긴다 — 초깃값으로만 쓰고
// 이후 prop 으로 화면을 다시 파생하지 않는다(서버 액션이 쿠키를 심으면 페이지가 다시 렌더되기 때문).
// 작성 화면은 임시 저장본을 읽은 뒤에 마운트한다: 서버·하이드레이션 스냅샷은 null(아직 모름) → 종이 머리만 그리고,
// 하이드레이션 직후 클라이언트 스냅샷(localStorage 문자열)으로 다시 렌더한다 — 빈 폼이 번쩍이거나 불일치가 나지 않는다.
// 표지: 처음 방문(제출 쿠키 없음)이면 "cover" 로 시작하고, 같은 스냅샷으로 임시 저장본이 있으면 표지를 건너뛰어 바로 폼,
// 없으면 표지를 보여 준다. '시작하기'·다시 작성하기·그래도 새로 작성하기는 "form" 으로 가므로 표지를 다시 보지 않는다.

type View = "cover" | "form" | "done" | "revisit" | "closed";

interface SurveyAppProps {
  slug: string; // lib/survey/surveys.ts 의 설문 — 임시 저장 키·제출 액션에 쓴다
  initialView: "form" | "revisit";
  // 서버(page.tsx)가 계산한 표지의 응답 마감 라벨. 마감 설정이 없으면 null.
  deadlineLabel: string | null;
}

function serverDraftSnapshot(): string | null {
  return null;
}

// 저장소에 임시 저장본이 있다 = 빈 값도 아니고 "저장소를 쓸 수 없음" 표시도 아니다
function hasStoredDraft(raw: string): boolean {
  return raw !== "" && raw !== DRAFT_UNAVAILABLE;
}

function FormShell() {
  return (
    <div className="svy-paper">
      <PaperHead />
      <noscript>
        <div className="svy-notice">
          <b>이 질의서는 자바스크립트가 켜져 있어야 작성할 수 있어요.</b>
        </div>
      </noscript>
    </div>
  );
}

export function SurveyApp({ slug, initialView, deadlineLabel }: SurveyAppProps) {
  // initialView 는 마운트 때 한 번만 읽는다. 제출 뒤 쿠키가 생겨 서버가 "revisit" 을 다시 넘겨도 화면은 그대로.
  // "cover" 는 처음 방문의 진입 화면 — 임시 저장본이 없을 때만 실제로 표지를 그린다.
  const [view, setView] = useState<View>(initialView === "revisit" ? "revisit" : "cover");
  const raw = useSyncExternalStore(subscribeDraft, () => readDraftRaw(slug), serverDraftSnapshot);
  // 새로 작성 = 폼을 새로 마운트(새 제출 id)
  const [formKey, setFormKey] = useState(0);
  const [closedAtLabel, setClosedAtLabel] = useState("");

  function freshForm() {
    setFormKey((k) => k + 1);
    setView("form");
  }

  function startFromCover() {
    window.scrollTo(0, 0);
    setView("form");
  }

  function renderForm(initialRaw: string) {
    return (
      <SurveyForm
        key={formKey}
        slug={slug}
        initialRaw={initialRaw}
        onDone={() => setView("done")}
        onClosed={(label) => {
          setClosedAtLabel(label);
          setView("closed");
        }}
      />
    );
  }

  switch (view) {
    case "done":
      return <DonePaper onRewrite={freshForm} />;
    case "revisit":
      return <RevisitPaper onShowDone={() => setView("done")} onRewrite={freshForm} />;
    case "closed":
      return <ClosedPaper closedAtLabel={closedAtLabel} notSubmitted />;
    case "cover":
      if (raw === null) return <FormShell />;
      if (hasStoredDraft(raw)) return renderForm(raw);
      return <CoverPaper deadlineLabel={deadlineLabel} onStart={startFromCover} />;
    case "form":
      if (raw === null) return <FormShell />;
      return renderForm(raw);
  }
}
