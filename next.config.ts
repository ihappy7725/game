import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 개발 배지가 작은 화면의 Dock을 가리지 않게 합니다. 컴파일·런타임 오류 표시는 유지됩니다.
  devIndicators: false,
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
