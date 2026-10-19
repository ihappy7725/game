import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 한글 본문용 폰트 (Geist에는 한글 글리프가 없습니다)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const siteTitle = "토플 유니온 | TOEFL Union";
const siteDescription =
  "공부와 게임으로 함께 성장하는 토플 유니온. 영어 읽기·듣기·쓰기·말하기를 나만의 속도로 연습하세요.";
const shareImage = {
  url: "/brand/share-card.png",
  width: 1200,
  height: 630,
  alt: "토플 유니온 로고와 공부와 게임으로 함께 성장하는 영어 소개",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://toefl-union.vercel.app"),
  applicationName: "토플 유니온",
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: "토플 유니온 | TOEFL Union",
    title: siteTitle,
    description: siteDescription,
    url: "https://toefl-union.vercel.app/",
    images: [shareImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [shareImage],
  },
  // 홈 화면에 추가했을 때 주소창 없이 앱처럼 실행됩니다.
  appleWebApp: { capable: true, title: "토플 유니온", statusBarStyle: "default" },
  // Next는 표준 이름(mobile-web-app-capable)만 내보냅니다. 구형 iOS용 이름을 함께 둡니다.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  // 홈 화면 앱의 상태 표시줄 색입니다. 확대 제한은 두지 않습니다(읽는 화면의 접근성).
  themeColor: "#12303a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${notoSansKr.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
