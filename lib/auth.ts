import "server-only";
import { cache } from "react";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { pool, withUser, one } from "@/lib/db";
import type { Database } from "@/lib/db/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Auth.js(NextAuth v5) — 이메일+비밀번호(Credentials). 세션은 서명된 JWT 쿠키(DB 세션 테이블 없음).
// 사용자 테이블은 RDS의 auth.users (db/bootstrap_rds.sql). 비밀번호 해시는 이전 시스템(2026-09 이관)에서 bcrypt 그대로 옮겨 왔다.
// 역할(role)은 토큰에 넣지 않고 매 요청 profiles에서 읽는다 — admin의 역할 변경이 즉시 반영되도록.

const config: NextAuthConfig = {
  trustHost: true, // ALB 뒤에서 Host 헤더 신뢰 (dev/prod 호스트 라우팅)
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(creds) {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        const c = await pool.connect();
        try {
          const r = await c.query<{ id: string; encrypted_password: string | null }>(
            "select id, encrypted_password from auth.users where lower(email) = $1",
            [email],
          );
          const u = r.rows[0];
          if (!u?.encrypted_password) return null;
          const ok = await bcrypt.compare(password, u.encrypted_password);
          if (!ok) return null;
          await c.query("update auth.users set last_sign_in_at = now() where id = $1", [u.id]);
          return { id: u.id, email };
        } finally {
          c.release();
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(config);

// 현재 로그인 사용자 id (없으면 null). 요청 단위로 메모이즈.
export const getSessionUserId = cache(async (): Promise<string | null> => {
  const s = await auth();
  return s?.user?.id ?? null;
});

// 현재 로그인 사용자의 프로필(역할 포함). 비로그인 시 null. 요청 단위로 메모이즈.
export const getSessionProfile = cache(async (): Promise<Profile | null> => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  return withUser(userId, (c) => one<Profile>(c, "select * from profiles where id = $1", [userId]));
});
