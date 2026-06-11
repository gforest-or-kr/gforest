"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// SCR-402 비밀번호 재설정 (1단계: 메일 발송) — 이관 직후 대량 사용 화면
export default function ResetPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const email = String(new FormData(e.currentTarget).get("email"));
    await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/reset-password/update`,
    });
    // 계정 존재 여부와 무관하게 동일 안내 (이메일 열거 방지)
    setSent(true);
  }

  if (sent) {
    return (
      <main className="max-w-sm mx-auto px-4 py-20 text-center">
        <p className="text-4xl mb-4">📮</p>
        <h1 className="text-xl font-bold">메일을 확인해 주세요</h1>
        <p className="mt-3 text-sm text-slate-500 leading-relaxed">
          가입된 이메일이라면 비밀번호 재설정 링크가 발송됩니다.
          <br />
          메일이 오지 않으면 스팸함을 확인해 주세요.
        </p>
      </main>
    );
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">비밀번호 재설정</h1>
      <p className="mt-3 text-sm text-slate-500 text-center leading-relaxed">
        기존 홈페이지에서 쓰던 이메일을 입력하면
        <br />
        재설정 링크를 보내드립니다.
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
        <button
          disabled={loading}
          className="w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3"
        >
          {loading ? "발송 중…" : "재설정 메일 보내기"}
        </button>
      </form>
    </main>
  );
}
