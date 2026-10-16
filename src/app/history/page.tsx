import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { HistoryWorkspace } from "@/components/HistoryWorkspace";

export const metadata = { title: "학습 기록 · 토플 고득점 도우미" };

export default function HistoryPage() {
  return (
    <main className="grain mx-auto w-full max-w-4xl px-5 py-12 sm:px-8">
      <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white/80">
        <ArrowLeft className="h-4 w-4" aria-hidden />홈으로
      </Link>
      <HistoryWorkspace />
    </main>
  );
}
