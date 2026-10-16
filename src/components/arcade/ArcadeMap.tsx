"use client";

import { useState, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { YellowCabRush } from "@/components/arcade/YellowCabRush";
import { CliffForkRun } from "@/components/arcade/CliffForkRun";
import { WordPop } from "@/components/arcade/WordPop";
import { cn } from "@/lib/cn";

/** NYC Arcade 로비.
 *
 *  맵 위 랜드마크 4개가 각각 게임 하나에 대응합니다. 지금은 타임스스퀘어의
 *  어휘·음성·리스닝 게임을 열고 오답 보스전은 준비 중입니다.
 *  (게임을 한 번에 네 개 만들지 않고 하나씩 완성하는 중입니다.)
 */

type GameId = "cab" | "fork" | "pop" | "boss";

type Landmark = {
  id: GameId;
  emoji: string;
  name: string;
  place: string;
  description: string;
  /** 맵 위 위치 (%) */
  position: { left: string; top: string };
  ready: boolean;
};

const LANDMARKS: Landmark[] = [
  {
    id: "cab",
    emoji: "🚕",
    name: "Yellow Cab Rush",
    place: "타임스스퀘어",
    description: "단어의 동의어 차선으로 택시를 몰아 3초 안에 통과",
    position: { left: "22%", top: "34%" },
    ready: true,
  },
  {
    id: "fork",
    emoji: "🎙️",
    name: "갈림길",
    place: "브루클린",
    description: "뜻에 맞는 길로 달리고 낙석을 뛰어넘기",
    position: { left: "68%", top: "26%" },
    ready: true,
  },
  {
    id: "pop",
    emoji: "🕵️",
    name: "워드 팝",
    place: "엠파이어 스테이트",
    description: "단어 블록 세 개를 연결해 연쇄 팡",
    position: { left: "46%", top: "58%" },
    ready: true,
  },
  {
    id: "boss",
    emoji: "👾",
    name: "Memory Boss Raid",
    place: "자유의 여신상",
    description: "틀렸던 문제를 다시 맞혀 보스 HP 깎기",
    position: { left: "78%", top: "66%" },
    ready: false,
  },
];

export function ArcadeMap() {
  const [playing, setPlaying] = useState<GameId | null>(null);

  if (playing === "cab" || playing === "fork" || playing === "pop") {
    return (
      <div>
        <button
          type="button"
          onClick={() => setPlaying(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-80"
          style={{ color: "var(--os-ink-dim)" }}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          맵으로
        </button>
        {playing === "cab" ? <YellowCabRush /> : playing === "fork" ? <CliffForkRun /> : <WordPop />}
      </div>
    );
  }

  return (
    <div>
      <div
        className="relative grid min-h-[380px] grid-cols-1 gap-3 overflow-hidden rounded-2xl px-4 pt-12 pb-4 sm:block sm:h-[380px] sm:p-0"
        style={{ border: "1px solid var(--os-border)" }}
      >
        <SceneBackdrop scene="libertySunset" />

        <p className="absolute top-4 left-5 text-[11px] font-medium tracking-[0.2em] uppercase" style={{ color: "var(--os-accent)" }}>
          NYC Arcade
        </p>

        {LANDMARKS.map((landmark, index) => (
          <motion.button
            key={landmark.id}
            type="button"
            disabled={!landmark.ready}
            onClick={() => landmark.ready && setPlaying(landmark.id)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 22, delay: index * 0.07 }}
            whileHover={landmark.ready ? { y: -4, scale: 1.04 } : undefined}
            style={{
              "--landmark-left": landmark.position.left,
              "--landmark-top": landmark.position.top,
              background: "var(--os-glass-strong)",
              border: `1px solid ${landmark.ready ? "var(--os-accent)" : "var(--os-border)"}`,
              boxShadow: landmark.ready ? "0 0 24px -4px var(--os-accent)" : undefined,
            } as CSSProperties}
            className={cn(
              "relative w-full rounded-xl p-3 text-left backdrop-blur-xl sm:absolute sm:top-[var(--landmark-top)] sm:left-[var(--landmark-left)] sm:w-[190px] sm:-translate-x-1/2",
              landmark.ready ? "cursor-pointer" : "cursor-not-allowed opacity-70",
            )}
          >
            <span className="flex items-center gap-2">
              <span className="text-xl" aria-hidden>
                {landmark.emoji}
              </span>
              <span className="min-w-0">
                <span className="block text-[10px] tracking-wide" style={{ color: "var(--os-ink-dim)" }}>
                  {landmark.place}
                </span>
                <span className="block truncate text-[13px] font-semibold">{landmark.name}</span>
              </span>
            </span>
            <span className="mt-1.5 block text-[11px] leading-snug" style={{ color: "var(--os-ink-dim)" }}>
              {landmark.description}
            </span>
            {!landmark.ready ? (
              <span
                className="mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px]"
                style={{ border: "1px solid var(--os-border)", color: "var(--os-ink-dim)" }}
              >
                준비 중
              </span>
            ) : null}
          </motion.button>
        ))}
      </div>

      <p className="mt-3 text-center text-[11px]" style={{ color: "var(--os-ink-dim)" }}>
        택시 어휘·브루클린 음성·맨해튼 리스닝 게임을 플레이할 수 있습니다. 오답 보스전은 준비 중입니다.
      </p>
    </div>
  );
}
