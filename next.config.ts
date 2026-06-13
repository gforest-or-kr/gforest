import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

// 번들 애널라이저는 opt-in — `ANALYZE=true next build`에서만 리포트 생성.
// 일반 빌드/Vercel 배포 동작·산출물에는 영향 없음 (#20).
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withBundleAnalyzer(nextConfig);
