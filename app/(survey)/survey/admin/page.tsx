import { pgCode, withUser } from "@/lib/db";
import {
  aggregateQuestions,
  countedResponses,
  dupGroups,
  overview,
  roleOtherTexts,
  type DupMode,
  type Overview,
} from "@/lib/survey/aggregate";
import { requireAdminPage } from "@/lib/survey/admin-guard";
import { formatKst, formatKstCompact, readClosesAt } from "@/lib/survey/config";
import { QUESTIONS, RESPONDENT_ROLES, SECTIONS } from "@/lib/survey/questions";
import { loadAdminRows } from "@/lib/survey/store";
import { PaperHead } from "../_components/papers";
import { QuestionResults } from "./_components/question-results";
import { ResponseList } from "./_components/response-list";

// 질의서 결과(관리자). 요청마다 렌더하고, 가드는 이 페이지가 직접 건다(레이아웃 가드 없음).
// 관리자 id 로 withUser — 관리자가 아니면 RLS 가 0행을 돌려준다. 사용자 글은 React 텍스트 노드로만 출력.
export const dynamic = "force-dynamic";

const TITLE = "의견 조사 결과";
const SUBTITLE = "푸른숲발도르프학교 · 관리자 화면";

function Notice({ head, body, alert = false }: { head: string; body: string; alert?: boolean }) {
  return (
    <div className="svy-notice" role={alert ? "alert" : undefined}>
      <b>{head}</b>
      {body}
    </div>
  );
}

function LeaderBox({ head, rows }: { head: string; rows: readonly { label: string; value: string }[] }) {
  return (
    <div className="svy-lead-box">
      <div className="svy-box-h">
        <span>{head}</span>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.label}>
            <span>{r.label}</span>
            <span>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ModeBox({ mode }: { mode: DupMode }) {
  const links: readonly { mode: DupMode; label: string }[] = [
    { mode: "include", label: "중복 의심 응답 포함" },
    { mode: "exclude", label: "중복 의심 응답 제외" },
  ];
  return (
    <div className="svy-box">
      <div className="svy-box-h">집계 기준</div>
      <div className="svy-box-b">
        <div>
          {links.map((l) => (
            <a
              key={l.mode}
              className="svy-toggle"
              href={`/survey/admin?dup=${l.mode}`}
              aria-current={l.mode === mode ? "true" : undefined}
            >
              {l.label}
            </a>
          ))}
        </div>
        <p className="svy-sm">
          같은 브라우저 또는 같은 IP에서 여러 번 제출된 응답을 &apos;중복 의심&apos;으로 묶어 표시합니다. 같은 기관의
          서로 다른 분일 수도 있어 자동으로 빼지는 않아요.
        </p>
      </div>
    </div>
  );
}

function closesAtLabel(): string {
  const c = readClosesAt();
  return c.kind === "set" ? formatKst(c.ms) : "미설정";
}

function OverviewBox({ ov }: { ov: Overview }) {
  return (
    <LeaderBox
      head="응답 현황"
      rows={[
        { label: "전체 응답", value: `${ov.total}건` },
        { label: "중복 의심 응답", value: `${ov.dupCount}건` },
        { label: "집계에 쓰인 응답", value: `${ov.countedCount}건` },
        { label: "응답 마감", value: closesAtLabel() },
        { label: "마지막 응답", value: ov.lastSubmittedAt ? formatKstCompact(ov.lastSubmittedAt) : "—" },
      ]}
    />
  );
}

function RoleCountsBox({ ov }: { ov: Overview }) {
  return (
    <>
      <LeaderBox
        head="응답자 구분별 건수"
        rows={ov.roleCounts.map((r) => ({ label: r.label, value: `${r.count}건` }))}
      />
      <p className="svy-sm">
        여러 구분에 해당한다고 답한 응답은 해당하는 구분마다 한 번씩 셉니다. 구분별 건수의 합은 전체 응답 수보다 클 수
        있어요.
      </p>
    </>
  );
}

// 평범한 <a download> — Next 의 Link 컴포넌트는 프리페치로 CSV 라우트를 미리 부른다.
function CsvArea({ enabled }: { enabled: boolean }) {
  return (
    <div className="svy-center">
      {enabled ? (
        <a className="svy-btn svy-btn--primary" href="/survey/admin/export" download>
          CSV 내려받기
        </a>
      ) : (
        <a className="svy-btn svy-btn--primary" aria-disabled="true">
          CSV 내려받기
        </a>
      )}
      <p className="svy-sm">
        {/* 빈 상태에는 집계 기준 상자가 없으므로 그 상자를 가리키는 말은 뺀다 */}
        {enabled
          ? "모든 응답을 내려받아요(중복 의심 표시 열 포함, 위 집계 기준과 상관없음). "
          : "응답이 들어오면 모든 응답을 내려받을 수 있어요(중복 의심 표시 열 포함). "}
        엑셀에서 한글이 깨지지 않도록 UTF-8(BOM)으로 저장돼요.
      </p>
    </div>
  );
}

function Paper({ children }: { children: React.ReactNode }) {
  return (
    <main className="svy-frame">
      <div className="svy-paper">
        <PaperHead title={TITLE} subtitle={SUBTITLE} />
        {children}
      </div>
    </main>
  );
}

export default async function SurveyAdminPage({ searchParams }: { searchParams: Promise<{ dup?: string | string[] }> }) {
  const profile = await requireAdminPage();
  const mode: DupMode = (await searchParams).dup === "exclude" ? "exclude" : "include";

  let data: Awaited<ReturnType<typeof loadAdminRows>>;
  try {
    data = await withUser(profile.id, loadAdminRows);
  } catch (e) {
    console.error("[survey-admin] load failed", pgCode(e) ?? "unknown"); // 내용·SQL 은 남기지 않는다
    return (
      <Paper>
        <Notice alert head="결과를 불러오지 못했어요." body="잠시 뒤 새로고침해 주세요. 계속되면 개발 담당에게 알려 주세요." />
      </Paper>
    );
  }

  const rows = data.responses;
  const dup = dupGroups(rows);
  const counted = countedResponses(rows, dup, mode);
  const ov = overview(rows, counted, RESPONDENT_ROLES, dup);

  if (rows.length === 0) {
    return (
      <Paper>
        <OverviewBox ov={ov} />
        <Notice
          head="아직 제출된 응답이 없어요."
          body="응답이 들어오면 이 화면에 문항별로 집계됩니다. 응답 주소는 /survey 입니다."
        />
        <CsvArea enabled={false} />
      </Paper>
    );
  }

  return (
    <Paper>
      <ModeBox mode={mode} />
      <OverviewBox ov={ov} />
      <RoleCountsBox ov={ov} />
      <CsvArea enabled />
      {/* 응답이 1건 이상이면 counted 도 1건 이상이다("제외"도 묶음마다 가장 나중에 낸 응답은 남긴다) */}
      <QuestionResults
        sections={SECTIONS}
        questions={aggregateQuestions(QUESTIONS, RESPONDENT_ROLES, counted, data.answers)}
        roleOther={roleOtherTexts(counted, RESPONDENT_ROLES)}
      />
      <ResponseList rows={rows} dup={dup} roles={RESPONDENT_ROLES} />
    </Paper>
  );
}
