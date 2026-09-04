import Link from "next/link";
import { ROLE_LABEL } from "@/lib/menu";
import type { Database } from "@/lib/db/types";

type AppRole = Database["public"]["Enums"]["app_role"];

// SCR-900 권한 안내 — 어떤 권한이 필요한지 명시해 행동 가능하게
export default function AccessNotice({
  boardName,
  readRoles,
  loggedIn,
  returnTo,
}: {
  boardName: string;
  readRoles: AppRole[];
  loggedIn: boolean;
  returnTo: string;
}) {
  return (
    <div className="py-24 text-center px-4">
      <p className="text-4xl mb-4">🔒</p>
      <h2 className="text-xl font-bold mb-2">{boardName}</h2>
      {loggedIn ? (
        <>
          <p className="text-slate-500 text-sm">
            이 게시판은{" "}
            <b className="text-forest-700">
              {readRoles.map((r) => ROLE_LABEL[r]).join(" / ")}
            </b>{" "}
            권한이 필요합니다.
          </p>
          <p className="text-slate-400 text-sm mt-1">
            권한이 필요하시면 운영진에게 문의해 주세요.
          </p>
        </>
      ) : (
        <>
          <p className="text-slate-500 text-sm">로그인이 필요한 게시판입니다.</p>
          <Link
            href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
            className="mt-5 inline-block bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl"
          >
            로그인
          </Link>
        </>
      )}
    </div>
  );
}
