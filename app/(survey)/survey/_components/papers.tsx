// 질의서 종이 한 장짜리 화면들(머리·도장·완료·재방문·마감). 훅 없음 — 서버 페이지(마감)와
// 클라이언트 SurveyApp(완료·재방문) 양쪽에서 렌더한다. 동작은 콜백 prop 으로만 받는다.

const TITLE = "새 홈페이지 이해관계자 의견 조사";
const SUBTITLE = "푸른숲발도르프학교";

export function PaperHead({ title = TITLE, subtitle = SUBTITLE }: { title?: string; subtitle?: string }) {
  return (
    <>
      <h1 className="svy-title">{title}</h1>
      <p className="svy-subtitle">{subtitle}</p>
      <hr className="svy-rule" />
    </>
  );
}

export function HowBox() {
  return (
    <div className="svy-how">
      <ul>
        <li>본인이 답할 수 있는 문항만 답해 주세요. 잘 모르시면 비워 두시거나 &quot;미정 / 모름&quot;에 표시하세요.</li>
        <li>해당하는 번호를 눌러 표시합니다. 보기에 없는 생각은 &quot;기타&quot; 칸에 적어 주세요.</li>
        <li>
          쓰신 내용은 <b>이 기기의 브라우저에 자동으로 임시 저장</b>됩니다. 제출하기 전까지는 서버로 보내지지 않아요.
        </li>
      </ul>
    </div>
  );
}

export function Stamp({ text }: { text: string }) {
  return (
    <p className="svy-stamp">
      <span>{text}</span>
    </p>
  );
}

export function DonePaper({ onRewrite }: { onRewrite: () => void }) {
  return (
    <div className="svy-paper">
      <PaperHead />
      <Stamp text="제 출 완 료" />
      <div className="svy-center">
        <p>의견을 보내 주셔서 감사합니다.</p>
        <p>보내신 내용은 이 화면에서 수정할 수 없어요.</p>
      </div>
      <div className="svy-notice">
        <b>※ 같은 분이 다시 제출하셔도 막지는 않지만,</b>
        결과를 볼 때 중복 응답으로 표시될 수 있어요. 잘못 보내셨다면 다시 한 번 제출해 주세요.
      </div>
      <div className="svy-center">
        <button type="button" className="svy-btn" onClick={onRewrite}>
          다시 작성하기
        </button>
      </div>
    </div>
  );
}

// 이 기기에서 이미 제출함(svy_bid 쿠키). 안내만 하고 막지 않는다.
export function RevisitPaper({ onShowDone, onRewrite }: { onShowDone: () => void; onRewrite: () => void }) {
  return (
    <div className="svy-paper">
      <PaperHead />
      <div className="svy-notice">
        <b>※ 이 기기에서 이미 제출하신 기록이 있어요.</b>
        이미 보내셨다면 다시 작성하지 않으셔도 됩니다. 내용을 바꾸거나 다른 분이 이 기기로 응답하시는 경우에는 계속
        작성하실 수 있어요(중복 응답은 결과에서 따로 표시됩니다).
      </div>
      <div className="svy-center">
        <button type="button" className="svy-btn" onClick={onShowDone}>
          제출 완료 화면 보기
        </button>
        <button type="button" className="svy-btn svy-btn--primary" onClick={onRewrite}>
          그래도 새로 작성하기
        </button>
      </div>
    </div>
  );
}

// 응답 기간이 끝남. 서버가 페이지 대신 렌더하거나, 작성 중 마감으로 제출이 거절됐을 때(notSubmitted) 보인다.
export function ClosedPaper({ closedAtLabel, notSubmitted }: { closedAtLabel: string; notSubmitted: boolean }) {
  return (
    <div className="svy-paper">
      <PaperHead />
      <Stamp text="접 수 마 감" />
      <div className="svy-center">
        <p>이해관계자 의견 조사 응답 기간이 끝났어요.</p>
        <p>의견을 주신 모든 분께 감사드립니다.</p>
        {notSubmitted && (
          <p>
            <b>작성하신 내용은 제출되지 않았어요.</b>
          </p>
        )}
      </div>
      <div className="svy-notice">
        <b>※ 응답 마감: {closedAtLabel}</b>
        추가로 전하실 의견은 학교 홈페이지 운영 담당자에게 직접 말씀해 주세요.
      </div>
    </div>
  );
}
