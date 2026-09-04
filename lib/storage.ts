import "server-only";
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// S3 미디어 버킷(MEDIA_BUCKET). 객체 키 = "<종류>/<storage_path>" (이전 시스템의 버킷 구조를 2026-09 이관 때 그대로 승계):
//   attachments/{uid}/{uuid}.{ext}  (비공개 — 서명 URL로만)
//   avatars/{uid}/{ts}.{ext}        (공개 — CloudFront 경로, 없으면 서명 URL)
//   site/{...}                      (슬라이드 등 공개)
// DB의 storage_path / avatar_path 컬럼은 종류 접두어 없이 저장한다(기존과 동일).

export type MediaKind = "attachments" | "avatars" | "site";

const region = process.env.AWS_REGION ?? "ap-northeast-2";
const bucket = () => process.env.MEDIA_BUCKET ?? "";
// 로컬 개발: S3_ENDPOINT(docker compose 의 MinIO, http://localhost:9000)를 주면 그쪽으로. 자격증명은 SDK 기본 체인
// (로컬은 .env.local 의 AWS_ACCESS_KEY_ID/SECRET = minioadmin, ECS 는 태스크 롤). 운영에서는 S3_ENDPOINT 를 두지 않는다.
const endpoint = process.env.S3_ENDPOINT;
const s3 = new S3Client({ region, ...(endpoint ? { endpoint, forcePathStyle: true } : {}) });

export const mediaKey = (kind: MediaKind, storagePath: string) => `${kind}/${storagePath}`;

// 업로드용 presigned PUT (5분). 클라이언트가 fetch(url, {method:"PUT", body:file})로 올린다.
export async function presignUpload(kind: MediaKind, storagePath: string, contentType: string) {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket(), Key: mediaKey(kind, storagePath), ContentType: contentType }),
    { expiresIn: 300 },
  );
}

// 다운로드/인라인용 presigned GET (기본 1시간). 서명은 로컬 연산이라 배치로 만들어도 네트워크 왕복 없음.
export async function presignGet(
  kind: MediaKind,
  storagePath: string,
  opts: { downloadName?: string; expiresIn?: number } = {},
) {
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: bucket(),
      Key: mediaKey(kind, storagePath),
      ResponseContentDisposition: opts.downloadName
        ? `attachment; filename*=UTF-8''${encodeURIComponent(opts.downloadName)}`
        : undefined,
    }),
    { expiresIn: opts.expiresIn ?? 3600 },
  );
}

export async function presignGetMany(kind: MediaKind, storagePaths: string[]) {
  const urls = await Promise.all(storagePaths.map((p) => presignGet(kind, p)));
  return new Map(storagePaths.map((p, i) => [p, urls[i]]));
}

export async function deleteMedia(kind: MediaKind, storagePaths: string[]) {
  if (storagePaths.length === 0) return;
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: bucket(),
      Delete: { Objects: storagePaths.map((p) => ({ Key: mediaKey(kind, p) })), Quiet: true },
    }),
  );
}

// 공개 미디어 URL. MEDIA_PUBLIC_BASE_URL(CloudFront)이 있으면 정적 URL, 없으면 서명 URL(24h).
export async function publicMediaUrl(kind: "avatars" | "site", storagePath: string | null | undefined) {
  if (!storagePath) return null;
  const base = process.env.MEDIA_PUBLIC_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${mediaKey(kind, storagePath)}`;
  return presignGet(kind, storagePath, { expiresIn: 24 * 3600 });
}
