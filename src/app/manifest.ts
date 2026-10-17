import type { MetadataRoute } from "next";

/** 홈 화면에 추가했을 때의 앱 정보입니다.
 *
 *  브라우저 탭에서는 화면 방향을 강제할 수 없지만, 홈 화면에서 실행한
 *  설치형 앱에는 orientation 이 실제로 적용됩니다. 가로 전용으로 만든
 *  화면이므로 landscape 로 고정합니다. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "토플 유니온 | TOEFL Union",
    short_name: "토플 유니온",
    description:
      "공부와 게임으로 함께 성장하는 토플 유니온. 영어 읽기·듣기·쓰기·말하기를 나만의 속도로 연습하세요.",
    lang: "ko",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "landscape",
    // 실행 직후 스플래시 색입니다. 오프닝 장면의 어두운 하늘과 맞춥니다.
    background_color: "#12303a",
    theme_color: "#12303a",
    categories: ["education", "games"],
    icons: [
      { src: "/brand/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // 안드로이드가 원형·둥근 사각형으로 잘라내도 그림이 남습니다.
      { src: "/brand/app-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
