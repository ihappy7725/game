"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import type { ReactNode } from "react";

type FeatureCardProps = {
  href: string;
  /** 렌더된 아이콘 엘리먼트. 서버 컴포넌트에서 아이콘 "함수"를 넘길 수는 없으므로
   *  호출하는 쪽에서 <PenLine /> 처럼 엘리먼트로 만들어 전달합니다. */
  icon: ReactNode;
  title: string;
  description: string;
  /** 아직 구현되지 않은 메뉴는 링크 없이 흐리게 표시합니다. */
  comingSoon?: boolean;
  delay?: number;
};

export function FeatureCard({
  href,
  icon,
  title,
  description,
  comingSoon = false,
  delay = 0,
}: FeatureCardProps) {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay }}
      whileHover={comingSoon ? undefined : { y: -4, scale: 1.015 }}
      whileTap={comingSoon ? undefined : { scale: 0.995 }}
      className="glass-soft glass-sheen h-full rounded-[var(--radius-card)] p-5"
    >
      <div className="flex items-start gap-4">
        <span className="glass-soft grid h-10 w-10 shrink-0 place-items-center rounded-xl text-accent-300">
          {icon}
        </span>
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-base font-semibold tracking-tight text-white">
            {title}
            {comingSoon ? (
              <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] font-medium text-white/50">
                준비 중
              </span>
            ) : null}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            {description}
          </p>
        </div>
      </div>
    </motion.div>
  );

  if (comingSoon) {
    return (
      <div aria-disabled className="cursor-not-allowed opacity-60">
        {card}
      </div>
    );
  }

  return (
    <Link href={href} className="block rounded-[var(--radius-card)]">
      {card}
    </Link>
  );
}
