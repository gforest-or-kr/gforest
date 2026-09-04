import "server-only";
import { unstable_cache } from "next/cache";
import {
  ECSClient,
  DescribeServicesCommand,
  DescribeTaskDefinitionCommand,
  ListTaskDefinitionsCommand,
} from "@aws-sdk/client-ecs";

// 배포 정보의 단일 진실은 ECS다. 이미지에 구운 값(APP_VERSION·APP_COMMIT·APP_BUILT_AT)은 "무엇을 빌드했나",
// 태스크 정의 리비전의 registeredAt은 "언제 배포했나". 배포 시각을 repo나 이미지에 넣으면 어긋나므로 API에서 읽는다.
// 권한: 태스크 롤 deploy-info-read(ecs:Describe*/ListTaskDefinitions). 로컬에서는 ECS_CLUSTER 미설정 → 빌드 정보만.

export type BuildInfo = {
  env: string;
  version: string;
  commit: string;
  builtAt: string | null;
  buildUrl: string | null;
};

export type DeployRecord = {
  revision: number;
  version: string | null;
  commit: string | null; // 이미지 태그 sha-<commit>에서 추출
  deployedAt: string; // 태스크 정의 등록 시각(=배포 시작)
  deployedBy: string | null;
  buildUrl: string | null;
  current: boolean;
};

export function getBuildInfo(): BuildInfo {
  return {
    env: process.env.APP_ENV ?? "local",
    version: process.env.APP_VERSION ?? "dev",
    commit: process.env.APP_COMMIT ?? "unknown",
    builtAt: process.env.APP_BUILT_AT && process.env.APP_BUILT_AT !== "unknown" ? process.env.APP_BUILT_AT : null,
    buildUrl: process.env.APP_BUILD_URL || null,
  };
}

function envOf(td: { environment?: { name?: string; value?: string }[] }, key: string) {
  return td.environment?.find((e) => e.name === key)?.value ?? null;
}

async function fetchDeployHistory(limit: number): Promise<{ current: DeployRecord | null; history: DeployRecord[] } | null> {
  const cluster = process.env.ECS_CLUSTER;
  const service = process.env.ECS_SERVICE;
  if (!cluster || !service) return null;
  const ecs = new ECSClient({ region: process.env.AWS_REGION ?? "ap-northeast-2" });

  const svc = await ecs.send(new DescribeServicesCommand({ cluster, services: [service] }));
  const primary = svc.services?.[0]?.deployments?.find((d) => d.status === "PRIMARY");
  const currentArn = primary?.taskDefinition ?? svc.services?.[0]?.taskDefinition ?? null;

  const list = await ecs.send(
    new ListTaskDefinitionsCommand({ familyPrefix: service, sort: "DESC", maxResults: limit, status: "ACTIVE" }),
  );
  const arns = list.taskDefinitionArns ?? [];
  const records = await Promise.all(
    arns.map(async (arn) => {
      const d = await ecs.send(new DescribeTaskDefinitionCommand({ taskDefinition: arn }));
      const td = d.taskDefinition;
      const c = td?.containerDefinitions?.[0];
      const image = c?.image ?? "";
      const m = image.match(/:sha-([0-9a-f]{7,40})$/);
      return {
        revision: td?.revision ?? 0,
        version: c ? envOf(c, "APP_VERSION") : null,
        commit: m ? m[1] : null,
        deployedAt: td?.registeredAt ? new Date(td.registeredAt).toISOString() : "",
        deployedBy: c ? envOf(c, "APP_DEPLOYED_BY") : null,
        buildUrl: c ? envOf(c, "APP_BUILD_URL") : null,
        current: arn === currentArn,
      } satisfies DeployRecord;
    }),
  );
  return { current: records.find((r) => r.current) ?? null, history: records };
}

// ECS API 호출은 1분 캐시 (페이지 새로고침 폭주 방지)
export const getDeployHistory = (limit = 20) =>
  unstable_cache(() => fetchDeployHistory(limit), ["deploy-history", String(limit)], { revalidate: 60 })();
