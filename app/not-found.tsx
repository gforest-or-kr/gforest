import Link from "next/link";

// SCR-900 (404)
export default function NotFound() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-24 text-center">
      <p className="text-4xl mb-4">🌲</p>
      <h1 className="text-xl font-bold">페이지를 찾을 수 없습니다</h1>
      <p className="mt-2 text-sm text-slate-500">
        주소가 바뀌었거나 삭제된 페이지일 수 있어요.
      </p>
      <Link
        href="/"
        className="mt-8 inline-block bg-forest-600 hover:bg-forest-700 text-white text-sm font-medium px-6 py-2.5 rounded-xl"
      >
        홈으로
      </Link>
    </main>
  );
}
