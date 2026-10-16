/** 첨부 레퍼런스 사진에서 추출한 장면(배경·위젯) 매니페스트.
 *
 *  각 항목은 실제 사진 경로와 함께 `fallback`(순수 CSS 그라데이션)을 가집니다.
 *  public/images/ 에 파일이 없거나 로딩에 실패해도 화면이 깨지지 않고
 *  같은 색감의 CSS 그래픽으로 렌더링됩니다. (SceneBackdrop 컴포넌트 참고)
 */

export type SceneId =
  | "nypl"
  | "nycStreet"
  | "libertySunset"
  | "library"
  | "whiteboard"
  | "desk";

export type Scene = {
  /** public/ 기준 경로 */
  src: string;
  alt: string;
  /** 사진에서 추출한 대표 색 (테마 토큰 생성에 사용) */
  palette: { base: string; mid: string; accent: string; glow: string };
  /** 사진이 없을 때 쓰는 순수 CSS 배경 */
  fallback: string;
  /** 위에 텍스트를 얹을 때 필요한 오버레이 농도 */
  scrim: string;
};

export const SCENES: Record<SceneId, Scene> = {
  // 뉴욕 공립도서관 로즈 메인 열람실: 아치형 창, 황동 스탠드, 원목 테이블
  nypl: {
    src: "/images/bg-nypl.jpg",
    alt: "뉴욕 공립도서관 열람실",
    palette: { base: "#2A1D12", mid: "#8A5F33", accent: "#C9A227", glow: "#F2D98D" },
    fallback:
      "radial-gradient(900px 420px at 50% 18%, rgba(242,217,141,0.30), transparent 62%)," +
      "radial-gradient(500px 300px at 12% 70%, rgba(201,162,39,0.22), transparent 70%)," +
      "linear-gradient(180deg, #3B2A1A 0%, #2A1D12 60%, #1B120B 100%)",
    scrim: "rgba(20,13,8,0.55)",
  },

  // 엠파이어 스테이트 빌딩 거리: 성조기, 노란 택시, 황금빛 석회암
  nycStreet: {
    src: "/images/bg-nyc-street.webp",
    alt: "엠파이어 스테이트 빌딩이 보이는 뉴욕 거리",
    palette: { base: "#1C2740", mid: "#C8A978", accent: "#F5C518", glow: "#A8C8E8" },
    fallback:
      "radial-gradient(700px 500px at 50% 8%, rgba(168,200,232,0.45), transparent 65%)," +
      "radial-gradient(420px 260px at 50% 92%, rgba(245,197,24,0.28), transparent 70%)," +
      "linear-gradient(180deg, #8FB4D9 0%, #C8A978 55%, #4A3A28 100%)",
    scrim: "rgba(16,22,36,0.45)",
  },

  // 자유의 여신상 핑크/퍼플 선셋 + 맨해튼 스카이라인
  libertySunset: {
    src: "/images/bg-liberty-sunset.jpg",
    alt: "핑크빛 노을의 자유의 여신상과 맨해튼 스카이라인",
    palette: { base: "#2B1B3A", mid: "#7B5E8C", accent: "#E89AA8", glow: "#F2A444" },
    fallback:
      "radial-gradient(800px 420px at 50% 72%, rgba(242,164,68,0.35), transparent 60%)," +
      "radial-gradient(900px 500px at 30% 20%, rgba(232,154,168,0.40), transparent 65%)," +
      "linear-gradient(180deg, #E89AA8 0%, #7B5E8C 48%, #2B1B3A 100%)",
    scrim: "rgba(28,16,40,0.42)",
  },

  // 서가: 다채로운 책등, 따뜻한 원목
  library: {
    src: "/images/bg-library.jpg",
    alt: "책이 가득한 도서관 서가",
    palette: { base: "#2E2118", mid: "#9A6B3F", accent: "#D9A441", glow: "#EBD9B8" },
    fallback:
      "repeating-linear-gradient(90deg, #6B4A2F 0 14px, #8A5F3C 14px 22px, #4E3622 22px 34px)," +
      "linear-gradient(180deg, #3A2A1C, #241A12)",
    scrim: "rgba(24,17,11,0.58)",
  },

  // 화이트보드 스터디: 따뜻한 베이지 벽, 붉은 마커
  whiteboard: {
    src: "/images/bg-whiteboard.jpg",
    alt: "화이트보드 앞에서 공부하는 모습",
    palette: { base: "#D9CDBA", mid: "#B9A88E", accent: "#B91C1C", glow: "#F5EFE4" },
    fallback:
      "radial-gradient(700px 400px at 50% 30%, rgba(245,239,228,0.9), transparent 70%)," +
      "linear-gradient(180deg, #E4D9C6 0%, #C8B99F 100%)",
    scrim: "rgba(60,48,34,0.25)",
  },

  // 데스크 플랫레이: 맥북, 아이패드, 아메리카노, 형광펜
  desk: {
    src: "/images/desk-study.jpg",
    alt: "맥북과 아이패드, 커피가 놓인 책상",
    palette: { base: "#2A1E16", mid: "#5A4334", accent: "#8FD14F", glow: "#EFE9DD" },
    fallback:
      "radial-gradient(600px 360px at 35% 35%, rgba(239,233,221,0.22), transparent 68%)," +
      "linear-gradient(145deg, #3B2C23 0%, #2A1E16 60%, #1A120D 100%)",
    scrim: "rgba(20,14,10,0.5)",
  },
};

/** 드래그 가능한 플로팅 위젯에 쓰는 사진(원본 대조용). */
export const WIDGET_PHOTOS = {
  winLearn: "/images/quote-win-learn.jpg",
  gentleReminder: "/images/quote-gentle-reminder.jpg",
  discipline: "/images/sticker-discipline.jpg",
  grateful: "/images/sticker-grateful.jpg",
} as const;

/** 기숙사 꾸미기·보상 화면에서 쓰는 장식 이미지. */
export const DECOR_PHOTOS = {
  graduation: "/images/deco-graduation.jpg",
  beSmart: "/images/deco-be-smart.jpg",
  butIDid: "/images/graph-but-i-did.jpg",
  motivationVsDiscipline: "/images/graph-motivation-discipline.jpg",
  overthinkingVsDoing: "/images/graph-overthinking-doing.jpg",
} as const;
