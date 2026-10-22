"use client";

import { useState } from "react";
import { ClosedPaper, DonePaper, RevisitPaper } from "./papers";
import { SurveyForm } from "./survey-form";

// 질의서 응답 화면(클라이언트). 첫 화면은 서버가 정해 initialView 로 넘긴다 — 초깃값으로만 쓰고
// 이후 prop 으로 화면을 다시 파생하지 않는다(서버 액션이 쿠키를 심으면 페이지가 다시 렌더되기 때문).

type View = "form" | "done" | "revisit" | "closed";

export function SurveyApp({ initialView }: { initialView: "form" | "revisit" }) {
  // initialView 는 마운트 때 한 번만 읽는다. 제출 뒤 쿠키가 생겨 서버가 "revisit" 을 다시 넘겨도 화면은 그대로.
  const [view, setView] = useState<View>(initialView);
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
      return (
        <SurveyForm
          key={formKey}
          initialRaw=""
          onDone={() => setView("done")}
          onClosed={(label) => {
            setClosedAtLabel(label);
            setView("closed");
          }}
        />
      );
  }
}
