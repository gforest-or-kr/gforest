"use client";

import { useState, useSyncExternalStore } from "react";
import { readDraftRaw, subscribeDraft } from "./draft";
import { ClosedPaper, DonePaper, PaperHead, RevisitPaper } from "./papers";
import { SurveyForm } from "./survey-form";

// 질의서 응답 화면(클라이언트). 첫 화면은 서버가 정해 initialView 로 넘긴다 — 초깃값으로만 쓰고
// 이후 prop 으로 화면을 다시 파생하지 않는다(서버 액션이 쿠키를 심으면 페이지가 다시 렌더되기 때문).
// 작성 화면은 임시 저장본을 읽은 뒤에 마운트한다: 서버·하이드레이션 스냅샷은 null(아직 모름) → 종이 머리만 그리고,
// 하이드레이션 직후 클라이언트 스냅샷(localStorage 문자열)으로 다시 렌더한다 — 빈 폼이 번쩍이거나 불일치가 나지 않는다.

type View = "form" | "done" | "revisit" | "closed";

function serverDraftSnapshot(): string | null {
  return null;
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

export function SurveyApp({ initialView }: { initialView: "form" | "revisit" }) {
  // initialView 는 마운트 때 한 번만 읽는다. 제출 뒤 쿠키가 생겨 서버가 "revisit" 을 다시 넘겨도 화면은 그대로.
  const [view, setView] = useState<View>(initialView);
  const raw = useSyncExternalStore(subscribeDraft, readDraftRaw, serverDraftSnapshot);
  // 새로 작성 = 폼을 새로 마운트(새 제출 id)
  const [formKey, setFormKey] = useState(0);
  const [closedAtLabel, setClosedAtLabel] = useState("");

  function freshForm() {
    setFormKey((k) => k + 1);
    setView("form");
  }

  switch (view) {
    case "done":
      return <DonePaper onRewrite={freshForm} />;
    case "revisit":
      return <RevisitPaper onShowDone={() => setView("done")} onRewrite={freshForm} />;
    case "closed":
      return <ClosedPaper closedAtLabel={closedAtLabel} notSubmitted />;
    case "form":
      if (raw === null) return <FormShell />;
      return (
        <SurveyForm
          key={formKey}
          initialRaw={raw}
          onDone={() => setView("done")}
          onClosed={(label) => {
            setClosedAtLabel(label);
            setView("closed");
          }}
        />
      );
  }
}
