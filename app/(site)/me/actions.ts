"use server";

import { getSessionUserId } from "@/lib/auth";
import { withUser, pgCode } from "@/lib/db";
import { deleteMedia } from "@/lib/storage";

// 프로필 수정 — 강제는 profiles_update RLS(본인 행만) + guard_role_change 트리거. role은 건드리지 않는다.
// 아바타는 클라가 presigned PUT으로 먼저 올린 뒤 경로만 넘긴다(본인 폴더 {uid}/… 만 허용).
export async function updateProfileAction(input: {
  nickname: string;
  name: string;
  avatar_path: string | null;
}): Promise<{ error: string } | { ok: true }> {
  const userId = await getSessionUserId();
  if (!userId) return { error: "로그인이 필요합니다" };
  const nickname = input.nickname.trim();
  const name = input.name.trim();
  if (nickname.length < 2 || nickname.length > 20) return { error: "닉네임은 2~20자로 입력해 주세요" };
  if (!name) return { error: "이름을 입력해 주세요" };
  const avatar_path = input.avatar_path;
  if (avatar_path && !avatar_path.startsWith(`${userId}/`)) return { error: "저장에 실패했어요" };

  let oldAvatar: string | null = null;
  try {
    await withUser(userId, async (c) => {
      oldAvatar = (
        await c.query<{ avatar_path: string | null }>("select avatar_path from profiles where id = $1", [userId])
      ).rows[0]?.avatar_path ?? null;
      const r = await c.query(
        "update profiles set nickname = $1, name = $2, avatar_path = $3 where id = $4",
        [nickname, name, avatar_path, userId],
      );
      if (r.rowCount === 0) throw new Error("denied");
    });
  } catch (e) {
    if (pgCode(e) === "23505") return { error: "이미 사용 중인 닉네임이에요" };
    return { error: "저장에 실패했어요" };
  }
  // 이전 아바타 정리(있으면, 실패 무시)
  if (oldAvatar && oldAvatar !== avatar_path) {
    await deleteMedia("avatars", [oldAvatar]).catch(() => {});
  }
  return { ok: true };
}
