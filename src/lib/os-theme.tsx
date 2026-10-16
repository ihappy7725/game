"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { SCENES, type SceneId } from "@/lib/scenes";

export type OsMode = "study" | "arcade";

type OsTheme = {
  label: string;
  /** 바탕화면에 깔 장면 */
  desktop: SceneId;
  /** CSS 변수로 내려보낼 토큰 */
  vars: Record<string, string>;
};

/** 테마 토큰은 globals.css가 아니라 Provider가 인라인 CSS 변수로 내려보낸다.
 *  모드 전환이 리렌더 없이 CSS 레벨에서 끝나고, 전역 스타일시트를 건드리지
 *  않아 다른 작업과 충돌하지 않는다. */
export const OS_THEMES: Record<OsMode, OsTheme> = {
  // 낮: 뉴욕 공립도서관의 황동 램프와 원목 — Warm Library Aesthetic
  study: {
    label: "Study OS",
    desktop: "nypl",
    vars: {
      "--os-ink": "#F5EFE4",
      "--os-ink-dim": "rgba(245,239,228,0.60)",
      "--os-accent": "#C9A227",
      "--os-accent-soft": "#F2D98D",
      // 유리는 "밝은 반투명"이 아니라 "어두운 반투명 + 블러"여야 한다.
      // 사진 배경이 밝으면 흰 유리는 글자와 대비가 무너진다(macOS 다크 비브런시와 같은 방식).
      "--os-glass": "rgba(42,29,18,0.42)",
      "--os-glass-strong": "rgba(26,18,11,0.62)",
      "--os-border": "rgba(245,239,228,0.16)",
      "--os-shadow": "0 24px 64px -12px rgba(26,16,8,0.65)",
      "--os-dock": "rgba(30,21,12,0.55)",
    },
  },
  // 밤: 자유의 여신상 노을 + 옐로캡 네온 — NYC Sunset & Neon Night
  arcade: {
    label: "NYC Arcade",
    desktop: "libertySunset",
    vars: {
      "--os-ink": "#FDF2F6",
      "--os-ink-dim": "rgba(253,242,246,0.62)",
      "--os-accent": "#F5C518",
      "--os-accent-soft": "#E89AA8",
      "--os-glass": "rgba(43,27,58,0.42)",
      "--os-glass-strong": "rgba(26,14,38,0.62)",
      "--os-border": "rgba(253,242,246,0.18)",
      "--os-shadow": "0 24px 70px -10px rgba(24,10,36,0.75)",
      "--os-dock": "rgba(30,16,44,0.58)",
    },
  },
};

type OsThemeValue = {
  mode: OsMode;
  theme: OsTheme;
  setMode: (mode: OsMode) => void;
  toggle: () => void;
};

const OsThemeContext = createContext<OsThemeValue | null>(null);

const STORAGE_KEY = "toefl-os-mode";

export function OsThemeProvider({ children }: { children: ReactNode }) {
  // 서버와 첫 렌더를 맞추기 위해 항상 study로 시작하고,
  // 저장된 모드는 마운트 이후에 반영한다 (하이드레이션 불일치 방지).
  const [mode, setMode] = useState<OsMode>("study");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "study" || saved === "arcade") setMode(saved);
    } catch {
      // 프라이빗 모드 등에서 접근이 막혀도 기본 모드로 동작한다.
    }
  }, []);

  const apply = useCallback((next: OsMode) => {
    setMode(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // 저장 실패는 무시 — 화면 동작에는 영향이 없다.
    }
  }, []);

  const value = useMemo<OsThemeValue>(
    () => ({
      mode,
      theme: OS_THEMES[mode],
      setMode: apply,
      toggle: () => apply(mode === "study" ? "arcade" : "study"),
    }),
    [mode, apply],
  );

  return (
    <OsThemeContext.Provider value={value}>
      <div
        data-os-mode={mode}
        style={OS_THEMES[mode].vars as React.CSSProperties}
        className="contents"
      >
        {children}
      </div>
    </OsThemeContext.Provider>
  );
}

export function useOsTheme() {
  const ctx = useContext(OsThemeContext);
  if (!ctx) throw new Error("useOsTheme은 OsThemeProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}

/** 모드별 바탕화면 장면의 팔레트 (맵·게임에서 참조) */
export function desktopPalette(mode: OsMode) {
  return SCENES[OS_THEMES[mode].desktop].palette;
}
