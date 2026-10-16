"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { EmbeddedPanels } from "@/components/GlassWindow";

/** 학습 본문은 공유하고 개별 경로에서만 페이지 여백과 홈 링크를 붙입니다. */
export function StudyFrame({ embedded, children }: { embedded: boolean; children: ReactNode }) {
  if (embedded) return <EmbeddedPanels>{children}</EmbeddedPanels>;
  return (
    <main className="grain mx-auto w-full max-w-3xl px-5 py-12 sm:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80">
        <ArrowLeft className="h-4 w-4" aria-hidden />홈으로
      </Link>
      {children}
    </main>
  );
}
