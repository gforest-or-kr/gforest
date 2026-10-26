import type {
  BoardAggregate,
  CardAggregate,
  FreeText,
  ItemAggregate,
  OptionAggregate,
  QuestionAggregate,
  RoleCount,
} from "@/lib/survey/aggregate";
import type { BoardAccess, BoardChoice, Section } from "@/lib/survey/types";

// 관리자 결과의 절별 집계(서버 컴포넌트, 훅 없음). item 종류로만 렌더가 갈린다 — 문항 id 분기 없음.
// 사용자가 쓴 글은 모두 React 텍스트 노드(.svy-txt-body 의 pre-wrap)로만 출력한다.

const NUMS = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"]; // 원 없는 일반 글자로 쓴다

// 작성 화면(board-table)과 같은 그룹 머리글
const BOARD_GROUPS: readonly { access: BoardAccess; label: string }[] = [
  { access: "public", label: "누구나 볼 수 있는 게시판" },
  { access: "login", label: "로그인 후 볼 수 있는 게시판" },
  { access: "restricted", label: "특정 권한이 필요한 게시판 — 실제 이용하시는 분만 표시" },
];

const BOARD_CHOICES: readonly { key: BoardChoice; label: string }[] = [
  { key: "keep", label: "유지" },
  { key: "merge", label: "통합" },
  { key: "drop", label: "폐지" },
];

// 학부모 5 · 교사회 3 (0 인 구분 생략, 모두 0 이면 —)
function breakdown(byRole: readonly RoleCount[], sep = " · "): string {
  const parts = byRole.filter((r) => r.count > 0).map((r) => `${r.label} ${r.count}`);
  return parts.length === 0 ? "—" : parts.join(sep);
}

function FreeList({ texts, summary }: { texts: readonly FreeText[]; summary: string }) {
  return (
    <details className="svy-more">
      <summary>{summary}</summary>
      {texts.map((t) => (
        <div className="svy-txt" key={t.no /* 한 목록 안에서 응답마다 하나 */}>
          <div className="svy-txt-body">{t.text}</div>
          <div className="svy-txt-meta">
            #{t.no} · {t.roleLabels}
          </div>
        </div>
      ))}
    </details>
  );
}

const Nothing = () => <p className="svy-sm">표시 없음</p>;

function SubHead({ title, answered, total }: { title: string | null; answered: number; total: number }) {
  return (
    <p className="svy-sh svy-sh--count">
      {title && <span>{title}</span>}
      <span className="svy-faint">
        응답 {answered}건 / 전체 {total}건
      </span>
    </p>
  );
}

function OptionRows({ options }: { options: readonly OptionAggregate[] }) {
  return (
    <div>
      {options.map((o, i) => (
        <div key={o.key}>
          <div className="svy-agg-row">
            <span>
              {NUMS[i] ?? `${i + 1}.`} {o.label}
            </span>
            <span>{o.count}</span>
          </div>
          <p className="svy-agg-brk">{breakdown(o.byRole)}</p>
          {o.hasBlank && o.blanks.length > 0 && (
            <FreeList texts={o.blanks} summary={`직접 쓴 답 ${o.blanks.length}건 보기`} />
          )}
        </div>
      ))}
    </div>
  );
}

function BoardRowResult({ row }: { row: BoardAggregate }) {
  const chosen = BOARD_CHOICES.filter((c) => row.counts[c.key] > 0);
  return (
    <div className="svy-brd">
      <div>
        <div className="svy-brd-name">{row.name}</div>
        {row.answered === 0 ? (
          <p className="svy-agg-brk">표시 없음</p>
        ) : (
          <p className="svy-agg-brk">
            {chosen.map((c) => `${c.label}: ${breakdown(row.byRole[c.key], ", ")}`).join(" / ")}
          </p>
        )}
        {row.targets.length > 0 && <FreeList texts={row.targets} summary={`직접 쓴 답 ${row.targets.length}건 보기`} />}
      </div>
      <span className="svy-qn">
        {BOARD_CHOICES.map((c) => `${c.label} ${row.counts[c.key]}`).join(" · ")}
      </span>
    </div>
  );
}

function BoardResults({ rows }: { rows: readonly BoardAggregate[] }) {
  return (
    <div>
      {BOARD_GROUPS.map((g) => {
        const inGroup = rows.filter((r) => r.access === g.access);
        if (inGroup.length === 0) return null;
        return (
          <div key={g.access}>
            <div className="svy-grp">
              {g.label} <span>{inGroup.length}개</span>
            </div>
            {inGroup.map((r) => (
              <BoardRowResult key={r.key} row={r} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function CardResult({ card, total }: { card: CardAggregate; total: number }) {
  return (
    <div className="svy-item">
      <div className="svy-item-h">
        <b>{card.name}</b>
        <span>{card.meta}</span>
      </div>
      <div className="svy-item-b">
        <SubHead title={card.purposeLabel} answered={card.purposes.length} total={total} />
        {card.purposes.length === 0 ? (
          <Nothing />
        ) : (
          <FreeList texts={card.purposes} summary={`직접 쓴 답 ${card.purposes.length}건 보기`} />
        )}
        <SubHead title="처리" answered={card.options.reduce((n, o) => n + o.count, 0)} total={total} />
        <OptionRows options={card.options} />
      </div>
    </div>
  );
}

function ItemResult({ item }: { item: ItemAggregate }) {
  switch (item.kind) {
    case "single":
    case "multi":
      return (
        <div className="svy-subq">
          <SubHead
            title={item.title && item.kind === "multi" ? `${item.title} (여러 개 선택 가능)` : item.title}
            answered={item.answered}
            total={item.total}
          />
          <OptionRows options={item.options} />
        </div>
      );
    case "text":
      return (
        <div className="svy-subq">
          <SubHead title={item.title} answered={item.answered} total={item.total} />
          {item.texts.length === 0 ? (
            <Nothing />
          ) : (
            <FreeList texts={item.texts} summary={`직접 쓴 답 ${item.texts.length}건 보기`} />
          )}
        </div>
      );
    // 게시판 표(.svy-grp/.svy-brd)·항목 상자(.svy-item)는 스스로 들여쓰므로 .svy-subq 로 감싸지 않는다
    case "boards":
      return (
        <>
          <div className="svy-subq">
            <SubHead title={null} answered={item.answered} total={item.total} />
          </div>
          <BoardResults rows={item.rows} />
        </>
      );
    case "cards":
      return (
        <>
          <div className="svy-subq">
            <SubHead title={null} answered={item.answered} total={item.total} />
          </div>
          {item.cards.map((c) => (
            <CardResult key={c.key} card={c} total={item.total} />
          ))}
        </>
      );
  }
}

function QuestionResult({ q }: { q: QuestionAggregate }) {
  return (
    <div className="svy-q">
      <h3 className="svy-qh">
        <span className="svy-qn">{q.no === null ? "" : `${q.no}.`}</span>
        <span>{q.title}</span>
      </h3>
      {q.items.map((item) => (
        <ItemResult key={item.key} item={item} />
      ))}
    </div>
  );
}

interface QuestionResultsProps {
  sections: readonly Section[];
  questions: readonly QuestionAggregate[];
  roleOther: readonly FreeText[];
}

export function QuestionResults({ sections, questions, roleOther }: QuestionResultsProps) {
  return (
    <>
      <nav className="svy-toc" aria-label="바로가기">
        바로가기:{" "}
        {sections.map((s) => (
          <a key={s.no} href={`#sec-${s.no}`}>
            {s.no}. {s.title}
          </a>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.no}>
          <h2 className="svy-sec" id={`sec-${s.no}`}>
            {s.no}. {s.title}
          </h2>
          {s.no === 0 ? (
            <div className="svy-q">
              {roleOther.length === 0 ? (
                <Nothing />
              ) : (
                <FreeList texts={roleOther} summary={`기타 직접 입력 ${roleOther.length}건`} />
              )}
            </div>
          ) : (
            questions
              .filter((q) => q.section === s.no)
              .map((q) => <QuestionResult key={q.id} q={q} />)
          )}
        </section>
      ))}
    </>
  );
}
