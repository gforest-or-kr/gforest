import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

// 브라우저(클라이언트 컴포넌트)용 Supabase 클라이언트 — 단일 인스턴스 재사용.
// 매 호출마다 새 인스턴스를 만들면 onAuthStateChange 구독이 다른 인스턴스에 걸려
// 로그인/로그아웃이 헤더 등 다른 컴포넌트에 반영되지 않는다(+ "Multiple GoTrueClient" 경고).
let browserClient: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return browserClient;
}
