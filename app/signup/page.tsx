"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// SCR-401 회원가입 — 가입 후 pending, 운영진 승인(역할 부여)으로 등업게시판 워크플로 대체
export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password"));
    if (password.length < 8) {
      setError("비밀번호는 8자 이상이어야 합니다.");
      setLoading(false);
      return;
    }
    const { error } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password,
      options: {
        data: {
          name: String(form.get("name")),
          nickname: String(form.get("nickname")),
        },
      },
    });
    if (error) {
      setError(
        error.message.includes("already")
          ? "이미 가입된 이메일입니다."
          : "가입에 실패했습니다. 잠시 후 다시 시도해 주세요.",
      );
      setLoading(false);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <main className="max-w-sm mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">🌱</p>
        <h1 className="text-xl font-bold">가입 신청이 완료되었습니다</h1>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          메일함에서 <b>인증 메일</b>을 확인해 주세요.
          <br />
          인증 후에도 회원 게시판은 <b>운영진 승인(등업)</b> 뒤에 이용할 수
          있습니다.
        </p>
        <Link
          href="/"
          className="mt-8 inline-block bg-forest-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl"
        >
          홈으로
        </Link>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">회원가입</h1>
      <p className="mt-3 text-sm text-slate-500 text-center leading-relaxed">
        푸른숲 가족(조합원) 확인 후 운영진이 회원 권한을 부여합니다.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          name="email"
          type="email"
          required
          placeholder="이메일"
          autoComplete="email"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px]"
        />
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="비밀번호 (8자 이상)"
          autoComplete="new-password"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px]"
        />
        <input
          name="name"
          required
          placeholder="이름 (실명)"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px]"
        />
        <input
          name="nickname"
          required
          maxLength={20}
          placeholder="닉네임 (게시판 표시 이름, 예: ○○네)"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px]"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3"
        >
          {loading ? "가입 중…" : "가입 신청"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        이미 계정이 있으신가요?{" "}
        <Link href="/login" className="text-forest-600 font-medium">
          로그인
        </Link>
      </p>
    </main>
  );
}
