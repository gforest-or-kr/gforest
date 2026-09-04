"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { buildMenu, ROLE_LABEL } from "@/lib/menu";
import type { getMenuData } from "@/lib/menu-data";
import type { Database } from "@/lib/db/types";

type AppRole = Database["public"]["Enums"]["app_role"];
type Props = Awaited<ReturnType<typeof getMenuData>> & {
  // 세션 프로필은 서버 부모(Header)가 읽어 넘긴다 — 클라에서 DB/Auth를 직접 호출하지 않는다.
  profile: { nickname: string; role: AppRole; avatarUrl: string | null } | null;
};

export default function HeaderNav({ boards, staticPages, profile }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null); // 데스크탑 드롭다운 (클릭 토글 — 호버 의존 금지)
  const pathname = usePathname();

  // role 기반 메뉴 필터(권한 게시판 등)도 서버가 준 role로 — 첫 페인트부터 로그인 메뉴가 나온다
  const menu = buildMenu(boards, staticPages, profile?.role ?? null);

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-3">
          <button
            className="lg:hidden p-2 -ml-2"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-2 font-bold text-forest-700 text-lg">
            <span className="w-8 h-8 rounded-xl bg-forest-600 text-white grid place-items-center">숲</span>
            <span className="hidden sm:block">푸른숲발도르프학교</span>
          </Link>

          {/* 데스크탑 GNB — 클릭 토글 드롭다운 */}
          <nav className="hidden lg:flex items-center gap-1 ml-8 text-[15px] font-medium">
            {menu.map((g) => (
              <div key={g.key} className="relative">
                <button
                  className={`px-3 py-2 rounded-lg hover:bg-forest-50 hover:text-forest-700 ${
                    openGroup === g.key ? "bg-forest-50 text-forest-700" : ""
                  }`}
                  onClick={() => setOpenGroup(openGroup === g.key ? null : g.key)}
                >
                  {g.label}
                </button>
                {openGroup === g.key && (
                  <div className="absolute left-0 top-full mt-1 w-56 rounded-2xl border border-slate-100 bg-white shadow-lg py-2 max-h-[70vh] overflow-y-auto">
                    {g.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpenGroup(null)}
                        className={`block px-4 py-2.5 text-sm hover:bg-forest-50 hover:text-forest-700 ${
                          pathname === item.href ? "text-forest-700 font-semibold" : "text-slate-600"
                        }`}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            {profile?.role === "admin" && (
              <Link
                href="/admin"
                className="hidden lg:block text-sm font-medium px-3 py-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                관리
              </Link>
            )}
            {profile ? (
              <Link
                href="/me"
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full hover:bg-slate-100 text-sm font-medium"
              >
                {profile.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="w-7 h-7 rounded-full bg-forest-100 text-forest-700 grid place-items-center text-xs font-bold">
                    {profile.nickname.slice(0, 1)}
                  </span>
                )}
                <span className="hidden sm:block">{profile.nickname}</span>
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-sm font-medium px-4 py-2 rounded-xl bg-forest-600 text-white hover:bg-forest-700"
              >
                로그인
              </Link>
            )}
          </div>
        </div>
        {/* 드롭다운 외부 클릭 닫기 */}
        {openGroup && (
          <div className="fixed inset-0 z-[-1]" onClick={() => setOpenGroup(null)} />
        )}
      </header>

      {/* 모바일 풀스크린 드로어 — 아코디언 2뎁스 */}
      <div
        className={`fixed inset-0 z-50 bg-white transition-transform lg:hidden overflow-y-auto ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="sticky top-0 bg-white h-14 px-4 flex items-center justify-between border-b border-slate-100">
          <span className="font-bold text-forest-700">메뉴</span>
          <button className="p-2 text-xl" onClick={() => setDrawerOpen(false)} aria-label="메뉴 닫기">
            ✕
          </button>
        </div>
        <div className="p-4 space-y-1 text-[15px]">
          {profile ? (
            <div className="flex items-center gap-3 p-3 mb-2 rounded-2xl bg-forest-50">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt=""
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <span className="w-10 h-10 rounded-full bg-forest-600 text-white grid place-items-center font-bold">
                  {profile.nickname.slice(0, 1)}
                </span>
              )}
              <div>
                <p className="font-semibold">{profile.nickname}님</p>
                <p className="text-xs text-slate-500">{ROLE_LABEL[profile.role]}</p>
              </div>
            </div>
          ) : (
            <Link
              href="/login"
              onClick={() => setDrawerOpen(false)}
              className="block p-3 mb-2 rounded-2xl bg-forest-600 text-white text-center font-semibold"
            >
              로그인 / 회원가입
            </Link>
          )}

          {menu.map((g) => (
            <details key={g.key} className="group">
              <summary className="flex justify-between items-center p-3 rounded-xl hover:bg-slate-50 font-medium cursor-pointer list-none">
                {g.label}
                <span className="text-slate-400 group-open:rotate-180 transition">⌄</span>
              </summary>
              <div className="pl-5 pb-2 space-y-0.5">
                {g.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    className={`block py-2.5 ${
                      pathname === item.href ? "text-forest-700 font-semibold" : "text-slate-600"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </details>
          ))}

          {profile && (
            <div className="border-t border-slate-100 mt-3 pt-3">
              {profile.role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="block p-3 font-medium"
                >
                  관리자
                </Link>
              )}
              {/* 로그아웃은 서버 액션(logoutAction) — 세션 쿠키 제거 후 /로 리다이렉트 */}
              <form action={logoutAction}>
                <button className="p-3 text-slate-500 w-full text-left">로그아웃</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
