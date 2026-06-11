"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// SCR-400 로그인
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo") ?? "/";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const form = new FormData(e.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({
      email: String(form.get("email")),
      password: String(form.get("password")),
    });
    if (error) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }
    router.push(returnTo);
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">로그인</h1>

      {/* 기존 회원 전환 안내 — 마이그레이션 후 상시 노출 */}
      <p className="mt-4 rounded-2xl bg-forest-50 text-forest-800 text-sm px-4 py-3 leading-relaxed">
        기존 홈페이지 회원은 가입 시 등록한 <b>이메일</b>로 로그인하세요. 비밀번호는{" "}
        <Link href="/reset-password" className="underline font-medium">
          재설정
        </Link>
        이 필요합니다.
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
        <div className="relative">
          <input
            name="password"
            type={showPw ? "text" : "password"}
            required
            placeholder="비밀번호"
            autoComplete="current-password"
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px] pr-16"
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 p-1"
          >
            {showPw ? "숨기기" : "보기"}
          </button>
        </div>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3"
        >
          {loading ? "로그인 중…" : "로그인"}
        </button>
      </form>

      <div className="mt-6 flex justify-center gap-4 text-sm text-slate-500">
        <Link href="/signup" className="hover:text-forest-700">
          회원가입
        </Link>
        <span className="text-slate-200">|</span>
        <Link href="/reset-password" className="hover:text-forest-700">
          비밀번호 재설정
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
