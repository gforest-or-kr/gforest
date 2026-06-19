"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// SCR-402 비밀번호 재설정 (2단계: 새 비밀번호) — 메일 링크로 진입 (recovery 세션)
export default function UpdatePasswordPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const password = String(new FormData(e.currentTarget).get("password"));
    const { error } = await createClient().auth.updateUser({ password });
    if (error) {
      setError("변경에 실패했습니다. 메일의 링크로 다시 접속해 주세요.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">새 비밀번호 설정</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input
          name="password"
          type="password"
          required
          minLength={8}
          placeholder="새 비밀번호 (8자 이상)"
          autoComplete="new-password"
          className="w-full border border-slate-200 rounded-xl px-4 py-3 text-[15px]"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          disabled={loading}
          className="w-full bg-forest-600 hover:bg-forest-700 disabled:opacity-60 text-white font-semibold rounded-xl py-3"
        >
          {loading ? "변경 중…" : "비밀번호 변경"}
        </button>
      </form>
    </main>
  );
}
