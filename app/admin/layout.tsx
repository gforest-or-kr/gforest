import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

// 관리자 영역 공통 — admin 외 접근 차단 (데이터 차단은 RLS가 이미 보장)
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getSessionProfile();
  if (!profile) redirect("/login?returnTo=/admin");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="max-w-6xl mx-auto px-4">
      <div className="mt-6 flex items-center gap-4 border-b border-slate-100 pb-3">
        <h1 className="font-bold text-lg">관리자</h1>
        <nav className="flex gap-1 text-sm">
          <Link href="/admin" className="px-3 py-1.5 rounded-lg hover:bg-forest-50 font-medium">
            회원·역할
          </Link>
        </nav>
      </div>
      {children}
    </div>
  );
}
