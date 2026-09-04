"use server";

import { randomUUID } from "node:crypto";
import { getSessionProfile } from "@/lib/auth";
import { presignUpload, deleteMedia, type MediaKind } from "@/lib/storage";
import { validateFile } from "@/lib/attachments";

// 클라이언트 업로드 준비: 권한·형식 검증 후 presigned PUT URL과 storage_path를 돌려준다.
// 경로는 항상 "{uid}/..." — 본인 폴더 외 업로드·삭제 불가(Supabase storage 정책과 동일 규칙).
export async function createUploadUrl(
  kind: "attachments" | "avatars",
  fileName: string,
  byteSize: number,
  mimeType: string,
): Promise<{ url: string; storage_path: string } | { error: string }> {
  const profile = await getSessionProfile();
  if (!profile) return { error: "로그인이 필요합니다." };
  if (kind === "attachments") {
    if (profile.role === "pending") return { error: "승인 후 이용할 수 있습니다." }; // 아바타는 pending도 가능(기존 정책과 동일)
    const reason = validateFile(fileName, byteSize);
    if (reason) return { error: reason };
  } else if (byteSize > 1024 * 1024 || !mimeType.startsWith("image/")) {
    return { error: "1MB 이하 이미지만 가능합니다." };
  }
  const ext = fileName.includes(".") ? fileName.slice(fileName.lastIndexOf(".") + 1).toLowerCase() : "bin";
  const storage_path = kind === "attachments" ? `${profile.id}/${randomUUID()}.${ext}` : `${profile.id}/${Date.now()}.${ext}`;
  const url = await presignUpload(kind, storage_path, mimeType || "application/octet-stream");
  return { url, storage_path };
}

// 업로드 취소 등으로 본인 폴더의 객체를 지운다 (attachments 행이 아직 없는 파일).
export async function deleteOwnUpload(kind: MediaKind, storagePath: string): Promise<void> {
  const profile = await getSessionProfile();
  if (!profile || !storagePath.startsWith(`${profile.id}/`)) return;
  await deleteMedia(kind, [storagePath]);
}
