"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { updatePasswordAction } from "@/lib/auth-actions";

// SCR-402 비밀번호 재설정 (2단계: 새 비밀번호) — 메일 링크(?token=…)로 진입.
// 토큰은 hidden input으로 서버 액션에 넘기고, 성공 시 /login?reset=1로 리다이렉트된다.
function UpdatePasswordForm() {
  const token = useSearchParams().get("token") ?? "";
  const [error, submit, loading] = useActionState(
    async (_prev: string | null, formData: FormData) => (await updatePasswordAction(formData))?.error ?? null,
    null,
  );

  return (
    <main className="max-w-sm mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold text-center">새 비밀번호 설정</h1>
      <form action={submit} className="mt-6 space-y-3">
        <input type="hidden" name="token" value={token} />
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

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordForm />
    </Suspense>
  );
}
