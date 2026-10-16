import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    viewport: { width: 1280, height: 900 },
    launchOptions: {
      executablePath: process.env.TEST_BROWSER_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe",
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    },
    permissions: ["microphone"],
    screenshot: "only-on-failure",
  },
  // 실제 환경 파일을 변경하지 않고 이 서버 프로세스에서만 로컬 모의 API를 사용합니다.
  // 기존 서버가 실행 중이면 포트 충돌로 실패하게 하여 타인의 서버를 사용하지 않습니다.
  webServer: [
    { command: "node tests/mock-service.mjs", url: "http://localhost:3101", reuseExistingServer: false },
    {
      command: "npm run dev", url: "http://localhost:3000", reuseExistingServer: false,
      env: {
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:3101",
        NEXT_PUBLIC_SUPABASE_URL: "http://localhost:3101",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "local-ui-test-key",
      },
    },
  ],
});
