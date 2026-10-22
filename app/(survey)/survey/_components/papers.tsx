// 질의서 종이 한 장짜리 화면들(머리·도장·표지·완료·재방문·마감). 훅 없음 — 서버 페이지(마감)와
// 클라이언트 SurveyApp(표지·완료·재방문) 양쪽에서 렌더한다. 동작은 콜백 prop 으로만 받는다.

const TITLE = "새 홈페이지 이해관계자 의견 조사";
const SUBTITLE = "푸른숲발도르프학교";

// ---- 표지·제출 완료 문구는 여기만 고친다 ----
interface CoverHowLine {
  readonly text: string;
  readonly bold?: string;
}
interface CoverInfoRow {
  readonly term: string;
  readonly desc: string;
}

const COVER_GREETING =
  "안녕하세요. 새 홈페이지 방향을 정하는 데 필요한 의견을 여쭙습니다. 정답이 있는 질문이 아니니 편하게 답해 주세요.";
const COVER_HOW_TITLE = "응답 방법";
const COVER_HOW_LINES: readonly CoverHowLine[] = [
  { text: "전체 27개 문항이 주제별로 묶여 있습니다. ", bold: "본인이 답할 수 있는 문항만 답해 주시면 됩니다." },
  { text: '잘 모르시는 문항은 비워 두시거나 "미정 / 모름"에 표시하고 다음으로 넘어가셔도 됩니다.' },
  { text: '해당하는 번호를 눌러 표시해 주세요. 보기에 없는 생각은 "기타" 칸에 자유롭게 적어 주세요.' },
  { text: "더 잘 아실 만한 분이 따로 계시면 그 문항만 전달해 주셔도 좋습니다." },
];
const COVER_INFO_ROWS: readonly CoverInfoRow[] = [
  {
    term: "익명",
    desc: "이름·연락처는 받지 않습니다. 응답자 구분(0절)만 표시합니다. 중복 응답 확인을 위해 복원할 수 없는 형태의 접속 정보만 임시로 둡니다.",
  },
  {
    term: "임시 저장",
    desc: "쓰신 내용은 이 기기의 브라우저에 자동으로 저장됩니다. 제출하기 전까지는 서버로 보내지지 않습니다.",
  },
];
const COVER_DEADLINE_TERM = "응답 마감";
const COVER_START = "시작하기";

const DONE_STAMP = "제 출 완 료";
const DONE_THANKS = "바쁘신 중에 시간 내어 의견 주셔서 진심으로 감사드립니다.";
const DONE_NO_EDIT = "보내신 내용은 이 화면에서 수정할 수 없습니다.";
const DONE_USAGE_TITLE = "※ 보내 주신 의견은 이렇게 쓰입니다";
const DONE_USAGE_BODY =
  "말씀하신 내용을 모두 반영하기는 어렵지만, 여러 분이 공통으로 요청하시는 내용은 진행 상황과 우선순위를 감안해 작업에 반영될 수 있습니다.";
const DONE_DUP_TITLE = "※ 같은 분이 다시 제출하셔도 막지는 않지만,";
const DONE_DUP_BODY = "결과를 볼 때 중복 응답으로 표시될 수 있어요. 잘못 보내셨다면 다시 한 번 제출해 주세요.";
const DONE_REWRITE = "다시 작성하기";
// ---- 문구 끝 ----

export function PaperHead({ title = TITLE, subtitle = SUBTITLE }: { title?: string; subtitle?: string }) {
  return (
    <>
      <h1 className="svy-title">{title}</h1>
      <p className="svy-subtitle">{subtitle}</p>
      <hr className="svy-rule" />
    </>
  );
}

export function Stamp({ text }: { text: string }) {
  return (
    <p className="svy-stamp">
      <span>{text}</span>
    </p>
  );
}

interface CoverPaperProps {
  // 서버(page.tsx)가 계산한 응답 마감 라벨. null 이면 마감 줄을 그리지 않는다.
  deadlineLabel: string | null;
  onStart: () => void;
}

// 표지(여는 쪽). 처음 방문 + 임시 저장본 없음일 때만 SurveyApp 이 보여 준다. 쪽 번호 바 없음.
export function CoverPaper({ deadlineLabel, onStart }: CoverPaperProps) {
  return (
    <div className="svy-paper">
      <PaperHead />
      <p className="svy-cover-greet">{COVER_GREETING}</p>
      <div className="svy-box">
        <h2 className="svy-box-h">{COVER_HOW_TITLE}</h2>
        <ul className="svy-cover-how">
          {COVER_HOW_LINES.map((line) => (
            <li key={line.text}>
              {line.text}
              {line.bold && <b>{line.bold}</b>}
            </li>
          ))}
        </ul>
      </div>
      <dl className="svy-info">
        {COVER_INFO_ROWS.map((row) => (
          <div className="svy-info-row" key={row.term}>
            <dt>{row.term}</dt>
            <dd>{row.desc}</dd>
          </div>
        ))}
        {deadlineLabel !== null && (
          <div className="svy-info-row">
            <dt>{COVER_DEADLINE_TERM}</dt>
            <dd>{deadlineLabel}</dd>
          </div>
        )}
      </dl>
      <div className="svy-center">
        <button type="button" className="svy-btn svy-btn--primary" onClick={onStart}>
          {COVER_START}
        </button>
      </div>
    </div>
  );
}

export function DonePaper({ onRewrite }: { onRewrite: () => void }) {
  return (
    <div className="svy-paper">
      <PaperHead />
      <Stamp text={DONE_STAMP} />
      <div className="svy-center">
        <p>{DONE_THANKS}</p>
        <p className="svy-sm">{DONE_NO_EDIT}</p>
      </div>
      <div className="svy-notice">
        <b>{DONE_USAGE_TITLE}</b>
        {DONE_USAGE_BODY}
      </div>
      <div className="svy-notice">
        <b>{DONE_DUP_TITLE}</b>
        {DONE_DUP_BODY}
      </div>
      <div className="svy-center">
        <button type="button" className="svy-btn" onClick={onRewrite}>
          {DONE_REWRITE}
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
