import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ECS Fargate 컨테이너용: node_modules 전체 대신 필요한 파일만 .next/standalone 에 모은다
  output: "standalone",
};

export default nextConfig;
