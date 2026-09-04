"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { randomBytes, createHash } from "node:crypto";
import { signIn, signOut } from "@/lib/auth";
import { pool, pgCode } from "@/lib/db";
import { sendMail } from "@/lib/mail";

// 로그인/가입/로그아웃/비밀번호 재설정 서버 액션. 클라이언트에서 DB·Auth를 직접 호출하지 않는다.

function safeReturnTo(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") ? s : "/";
}

export async function loginAction(formData: FormData): Promise<{ error: string } | void> {
  const returnTo = safeReturnTo(formData.get("returnTo"));
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: returnTo,
    });
  } catch (e) {
    if (e instanceof AuthError) return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
    throw e; // NEXT_REDIRECT 등은 그대로 전파
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/" });
}

// 가입 즉시 pending 역할 — 운영진 승인(등업)이 게이트이므로 이메일 인증은 두지 않는다.
export async function signupAction(formData: FormData): Promise<{ error: string } | { ok: true }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const nickname = String(formData.get("nickname") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "이메일 형식이 올바르지 않습니다." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  if (!name || !nickname || nickname.length > 20) return { error: "이름과 닉네임을 확인해 주세요." };

  const hash = await bcrypt.hash(password, 10);
  try {
    // auth.users insert → on_auth_user_created 트리거가 profiles(pending) 생성 (raw_user_meta_data의 name/nickname 사용)
    await pool.query(
      `insert into auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
       values ($1, $2, now(), $3::jsonb)`,
      [email, hash, JSON.stringify({ name, nickname })],
    );
  } catch (e) {
    if (pgCode(e) === "23505") {
      return { error: /nickname/.test(String(e)) ? "이미 사용 중인 닉네임입니다." : "이미 가입된 이메일입니다." };
    }
    return { error: "가입에 실패했습니다. 잠시 후 다시 시도해 주세요." };
  }
  return { ok: true };
}

// --- 비밀번호 재설정: 1회용 토큰(해시 저장, 1시간) → 메일 링크 → 새 비밀번호 ---

function tokenHash(t: string) {
  return createHash("sha256").update(t).digest("hex");
}

export async function requestPasswordResetAction(formData: FormData): Promise<{ ok: true }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const u = await pool.query<{ id: string }>("select id from auth.users where lower(email) = $1", [email]);
  // 존재 여부를 노출하지 않는다 — 계정이 있을 때만 메일 발송, 응답은 동일
  if (u.rows[0]) {
    const token = randomBytes(32).toString("base64url");
    await pool.query(
      `insert into auth.password_reset_tokens (user_id, token_hash, expires_at)
       values ($1, $2, now() + interval '1 hour')`,
      [u.rows[0].id, tokenHash(token)],
    );
    const link = `${site}/reset-password/update?token=${token}`;
    await sendMail({
      to: email,
      subject: "[푸른숲발도르프학교] 비밀번호 재설정",
      text: `아래 링크에서 새 비밀번호를 설정하세요 (1시간 유효).\n\n${link}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.`,
    });
  }
  return { ok: true };
}

export async function updatePasswordAction(formData: FormData): Promise<{ error: string } | void> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) return { error: "비밀번호는 8자 이상이어야 합니다." };
  const r = await pool.query<{ user_id: string }>(
    `delete from auth.password_reset_tokens
      where token_hash = $1 and expires_at > now() returning user_id`,
    [tokenHash(token)],
  );
  const userId = r.rows[0]?.user_id;
  if (!userId) return { error: "링크가 만료되었거나 유효하지 않습니다. 다시 요청해 주세요." };
  await pool.query("update auth.users set encrypted_password = $1, updated_at = now() where id = $2", [
    await bcrypt.hash(password, 10),
    userId,
  ]);
  redirect("/login?reset=1");
}
