import { BarChart3, Headphones, Mic, PenLine } from "lucide-react";
import { AuthStatus } from "@/components/AuthStatus";
import { BackendStatus } from "@/components/BackendStatus";
import { FeatureCard } from "@/components/FeatureCard";
import { GlassWindow } from "@/components/GlassWindow";

export default function Home() {
  return (
    <main className="grain mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-5 py-16 sm:px-8">
      <GlassWindow
        title="토플 고득점 도우미"
        toolbar={
          <div className="flex items-center gap-3">
            <BackendStatus />
            <span aria-hidden className="h-3 w-px bg-white/15" />
            <AuthStatus />
          </div>
        }
      >
        {/* 히어로 */}
        <p className="text-[11px] font-medium tracking-[0.2em] text-accent-300/80 uppercase">
          TOEFL iBT · AI 첨삭 트레이닝
        </p>

        <h1 className="mt-4 bg-gradient-to-br from-white via-white to-accent-300/70 bg-clip-text text-4xl leading-[1.15] font-semibold tracking-tight text-transparent sm:text-5xl">
          오늘의 한 편이
          <br />
          유학의 거리를 좁힌다
        </h1>

        <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-white/60">
          ETS 루브릭을 기준으로 GPT-4o가 에세이와 스피킹을 채점하고, 점수를 끌어올릴
          교정문과 구체적인 연습 과제를 바로 돌려줍니다.
        </p>

        {/* 기능 카드 */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <FeatureCard
            href="/writing"
            icon={<PenLine className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Writing 첨삭"
            description="에세이를 ETS 5점 척도로 채점하고, 논지를 유지한 교정문을 제시합니다."
            delay={0.05}
          />
          <FeatureCard
            href="/speaking"
            icon={<Mic className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Speaking 첨삭"
            description="브라우저에서 녹음하면 Whisper가 전사하고 GPT-4o가 4점 척도로 평가합니다."
            delay={0.1}
          />
          <FeatureCard
            href="/practice"
            icon={<Headphones className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="Reading / Listening"
            description="실전 모의고사를 자동 채점하고 취약 유형을 분석합니다."
            comingSoon
            delay={0.15}
          />
          <FeatureCard
            href="/history"
            icon={<BarChart3 className="h-5 w-5" strokeWidth={1.75} aria-hidden />}
            title="학습 기록"
            description="지난 제출물과 섹션별 평균·최고 점수 추이를 한눈에 확인합니다."
            delay={0.2}
          />
        </div>
      </GlassWindow>

      <p className="mt-6 px-1 text-center text-xs text-white/35">
        백엔드: FastAPI · localhost:8000 &nbsp;·&nbsp; 채점 모델: GPT-4o + Whisper-1
      </p>
    </main>
  );
}
