"use server";

import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSessionUserId } from "@/lib/auth";
import { withUser, one } from "@/lib/db";
import { deleteMedia, mediaKey } from "@/lib/storage";

// 권한 강제는 slides_admin RLS에 위임(CLAUDE.md #3). 액션은 입력 검증·스토리지 경로 관리만 담당한다.
// 이미지는 서버 액션이 File을 받아 S3 "site/<path>"에 직접 올린다(admin 전용 화면이라 presign 불필요).
// 업로드 경로에 대한 별도 권한은 없으므로, 행 insert가 RLS에 막히면 올린 객체를 되돌린다.

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const KIND = "site";

// lib/storage.ts는 S3 클라이언트를 내보내지 않으므로 여기서 동일 설정으로 하나 만든다
const s3 = new S3Client({ region: process.env.AWS_REGION ?? "ap-northeast-2" });

async function putSiteObject(path: string, file: File) {
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.MEDIA_BUCKET ?? "",
      Key: mediaKey(KIND, path),
      Body: Buffer.from(await file.arrayBuffer()),
      ContentType: file.type || "application/octet-stream",
    }),
  );
}

function revalidate() {
  revalidatePath("/admin/slides");
  revalidatePath("/");
}

function ext(file: File) {
  const dot = file.name.lastIndexOf(".");
  return dot > -1 ? file.name.slice(dot + 1).toLowerCase() : "img";
}

// 파일이 이미지이고 2MB 이하인지 검증. 통과 못 하면 메시지 반환.
function checkImage(file: File | null, label: string): string | null {
  if (!file || file.size === 0) return `${label} 이미지를 선택하세요`;
  if (!file.type.startsWith("image/")) return `${label} 이미지 형식이 아닙니다`;
  if (file.size > MAX_BYTES) return `${label} 이미지는 2MB 이하여야 합니다`;
  return null;
}

export async function createSlide(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim() || null;
  const link_url = String(formData.get("link_url") ?? "").trim() || null;
  const sort_order = Number(formData.get("sort_order") ?? 0) || 0;
  const desktop = formData.get("image_desktop") as File | null;
  const mobile = formData.get("image_mobile") as File | null;

  if (!title) return;
  if (checkImage(desktop, "데스크탑")) return;
  if (checkImage(mobile, "모바일")) return;

  // admin이 아니면 S3 업로드 전에 끊는다(RLS는 insert에서 재차 강제)
  const userId = await getSessionUserId();
  if (!userId) return;

  const id = crypto.randomUUID();
  const desktopPath = `slides/${id}-d.${ext(desktop!)}`;
  const mobilePath = `slides/${id}-m.${ext(mobile!)}`;

  try {
    await putSiteObject(desktopPath, desktop!);
  } catch {
    return;
  }
  try {
    await putSiteObject(mobilePath, mobile!);
  } catch {
    await deleteMedia(KIND, [desktopPath]).catch(() => {});
    return;
  }

  try {
    await withUser(userId, (c) =>
      c.query(
        `insert into slides (id, title, subtitle, link_url, image_desktop_path, image_mobile_path, sort_order)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [id, title, subtitle, link_url, desktopPath, mobilePath, sort_order],
      ),
    );
  } catch {
    await deleteMedia(KIND, [desktopPath, mobilePath]).catch(() => {});
    return;
  }

  revalidate();
}

// 메타데이터만 갱신(이미지 미변경 시 path 유지)
export async function updateSlide(id: string, formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  // RLS가 막으면 0행(무시 — 기존 동작과 동일)
  await withUser(await getSessionUserId(), (c) =>
    c.query(
      `update slides set title = $1, subtitle = $2, link_url = $3, sort_order = $4, is_active = $5 where id = $6`,
      [
        title,
        String(formData.get("subtitle") ?? "").trim() || null,
        String(formData.get("link_url") ?? "").trim() || null,
        Number(formData.get("sort_order") ?? 0) || 0,
        formData.get("is_active") === "on",
        id,
      ],
    ),
  );

  revalidate();
}

export async function deleteSlide(id: string) {
  // 행 삭제(RLS 강제)가 성공한 뒤에만 S3 객체를 지운다
  const deleted = await withUser(await getSessionUserId(), (c) =>
    one<{ image_desktop_path: string; image_mobile_path: string }>(
      c,
      "delete from slides where id = $1 returning image_desktop_path, image_mobile_path",
      [id],
    ),
  );
  if (deleted) {
    await deleteMedia(KIND, [deleted.image_desktop_path, deleted.image_mobile_path]).catch(() => {});
  }
  revalidate();
}
