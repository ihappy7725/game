"use client";

/** OS 셸 미리보기 (임시).
 *  본 통합(page.tsx 교체) 전에 메뉴바·Dock·창·위젯·테마 전환이
 *  실제로 동작하는지 확인하기 위한 라우트입니다. 통합 후 삭제 예정. */

import { Desktop, type AppDefinition } from "@/components/os/Desktop";
import { OsThemeProvider } from "@/lib/os-theme";

const STUB_APPS: Partial<Record<string, AppDefinition>> = {
  writing: {
    title: "Writing AI",
    width: 680,
    render: () => (
      <p className="text-sm leading-relaxed" style={{ color: "var(--os-ink-dim)" }}>
        여기에 기존 Writing 첨삭 화면이 들어갑니다. (이식 예정)
      </p>
    ),
  },
  speaking: {
    title: "Speaking AI",
    width: 620,
    render: () => (
      <p className="text-sm leading-relaxed" style={{ color: "var(--os-ink-dim)" }}>
        여기에 기존 Speaking 첨삭 화면이 들어갑니다. (이식 예정)
      </p>
    ),
  },
  history: {
    title: "History",
    width: 760,
    render: () => (
      <p className="text-sm leading-relaxed" style={{ color: "var(--os-ink-dim)" }}>
        학습 기록 대시보드가 들어갑니다.
      </p>
    ),
  },
  reading: {
    title: "Reading & Listening",
    render: () => <p className="text-sm">준비 중</p>,
  },
  dorm: { title: "My NYC Dorm", render: () => <p className="text-sm">준비 중</p> },
  arcade: { title: "NYC Arcade", render: () => <p className="text-sm">준비 중</p> },
};

export default function OsPreviewPage() {
  return (
    <OsThemeProvider>
      <Desktop apps={STUB_APPS} />
    </OsThemeProvider>
  );
}
