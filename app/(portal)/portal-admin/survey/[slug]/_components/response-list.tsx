import { DUP_REASON_LABEL, roleLabels, type DupMap } from "@/lib/survey/aggregate";
import { formatKstCompact } from "@/lib/survey/config";
import type { AdminResponseRow, RespondentRole } from "@/lib/survey/types";

// 응답 목록(서버 컴포넌트). 집계 기준 토글과 상관없이 모든 응답을 번호순으로 보여 주고,
// 중복 의심 묶음은 번호·사유만 표시한다(해시 값은 화면에 내보내지 않는다). 삭제·수정 기능 없음.

interface ResponseListProps {
  rows: readonly AdminResponseRow[];
  dup: DupMap;
  roles: readonly RespondentRole[];
}

export function ResponseList({ rows, dup, roles }: ResponseListProps) {
  const sorted = [...rows].sort((a, b) => a.no - b.no);
  return (
    <details className="svy-more">
      <summary>응답 목록 ({sorted.length}건) 보기</summary>
      {sorted.map((r) => {
        const d = dup.get(r.id);
        return (
          <div className="svy-resp" key={r.id}>
            #{r.no} · {formatKstCompact(r.submittedAt)} · {roleLabels(r.roles, roles)}
            {d && (
              <p className="svy-dup">
                ※ 중복 의심 · 묶음 {d.group} ({DUP_REASON_LABEL[d.reason]})
              </p>
            )}
          </div>
        );
      })}
    </details>
  );
}
