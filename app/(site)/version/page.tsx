import type { Metadata } from "next";
import { getBuildInfo, getDeployHistory } from "@/lib/deploy-info";

// 배포 버전 확인 페이지. prod(전체 공개)는 버전·빌드 시각만, dev는 배포 이력(ECS 태스크 정의 리비전)까지 보여준다.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "버전 정보", robots: { index: false, follow: false } };

function fmt(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul", hour12: false });
}

export default async function VersionPage() {
  const build = getBuildInfo();
  const detailed = build.env !== "prod";
  const deploy = detailed ? await getDeployHistory(20).catch(() => null) : null;
  const current = deploy?.current ?? null;

  return (
    <main className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold">버전 정보</h1>
      <dl className="mt-6 grid grid-cols-[8rem_1fr] gap-y-2 text-[15px]">
        <dt className="text-slate-500">환경</dt>
        <dd className="font-medium">{build.env}</dd>
        <dt className="text-slate-500">버전</dt>
        <dd className="font-mono">{build.version}</dd>
        <dt className="text-slate-500">빌드 시각</dt>
        <dd>{fmt(build.builtAt)}</dd>
        {detailed && (
          <>
            <dt className="text-slate-500">커밋</dt>
            <dd className="font-mono break-all">{build.commit}</dd>
            <dt className="text-slate-500">배포 시각</dt>
            <dd>{current ? fmt(current.deployedAt) : "-"}</dd>
            <dt className="text-slate-500">배포자</dt>
            <dd>{current?.deployedBy ?? "-"}</dd>
            {build.buildUrl && (
              <>
                <dt className="text-slate-500">빌드 로그</dt>
                <dd>
                  <a href={build.buildUrl} className="text-forest-600 underline break-all" target="_blank" rel="noreferrer">
                    GitHub Actions
                  </a>
                </dd>
              </>
            )}
          </>
        )}
      </dl>

      {detailed && (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">배포 이력</h2>
          <p className="mt-1 text-sm text-slate-500">
            ECS 태스크 정의 리비전 기준(등록 시각 = 배포 시작). 1분 캐시.
          </p>
          {!deploy ? (
            <p className="mt-4 text-sm text-slate-500">배포 이력을 읽을 수 없습니다(로컬 실행이거나 ECS 권한 없음).</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 pr-3">리비전</th>
                    <th className="py-2 pr-3">버전</th>
                    <th className="py-2 pr-3">커밋</th>
                    <th className="py-2 pr-3">배포 시각</th>
                    <th className="py-2 pr-3">배포자</th>
                  </tr>
                </thead>
                <tbody>
                  {deploy.history.map((r) => (
                    <tr key={r.revision} className={`border-b border-slate-100 ${r.current ? "bg-forest-50 font-medium" : ""}`}>
                      <td className="py-2 pr-3">
                        {r.revision}
                        {r.current && <span className="ml-1 text-xs text-forest-700">현재</span>}
                      </td>
                      <td className="py-2 pr-3 font-mono">{r.version ?? "-"}</td>
                      <td className="py-2 pr-3 font-mono">
                        {r.commit ? (
                          <a
                            href={`https://github.com/gforest-or-kr/gforest/commit/${r.commit}`}
                            className="underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {r.commit.slice(0, 7)}
                          </a>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-2 pr-3 whitespace-nowrap">{fmt(r.deployedAt)}</td>
                      <td className="py-2 pr-3">{r.deployedBy ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
