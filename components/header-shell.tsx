import Link from "next/link";

// Header 스트리밍 중 표시되는 정적 셸 — 로고만 즉시, 메뉴는 로드 후 교체
export default function HeaderShell() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 h-14 lg:h-16 flex items-center gap-3">
        <span className="lg:hidden w-10 h-10" />
        <Link href="/" className="flex items-center gap-2 font-bold text-forest-700 text-lg">
          <span className="w-8 h-8 rounded-xl bg-forest-600 text-white grid place-items-center">숲</span>
          <span className="hidden sm:block">푸른숲발도르프학교</span>
        </Link>
      </div>
    </header>
  );
}
