import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 배지가 작은 화면의 Dock을 가리지 않게 합니다. 컴파일·런타임 오류 표시는 유지됩니다.
  devIndicators: false,
  // Vercel Services(Beta)로 배포하면 최상위 rewrite가 모든 요청을 서비스로 보내고,
  // 플랫폼의 /_next/image 최적화 경로는 등록되지 않아 404가 됩니다.
  // 자산은 이미 webp로 적정 크기라 최적화를 끄고 원본을 그대로 내보냅니다.
  images: { unoptimized: true },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
