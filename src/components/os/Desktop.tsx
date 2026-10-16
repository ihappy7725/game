"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { SceneBackdrop } from "@/components/SceneBackdrop";
import { DesktopWindow } from "@/components/os/DesktopWindow";
import { Dock, DOCK_APPS } from "@/components/os/Dock";
import { FloatingWidget } from "@/components/os/FloatingWidget";
import { MenuBar, type TierId } from "@/components/os/MenuBar";
import { PhotoSticker } from "@/components/os/PhotoSticker";
import { QuoteCardGentleReminder } from "@/components/os/QuoteCardGentleReminder";
import { QuoteCardWinLearn } from "@/components/os/QuoteCardWinLearn";
import { WIDGET_PHOTOS } from "@/lib/scenes";
import { useOsTheme } from "@/lib/os-theme";

/** Dock에서 열리는 앱 하나의 내용. 셸은 창만 그리고 내용은 주입받는다. */
export type AppDefinition = {
  title: string;
  width?: number;
  render: () => ReactNode;
};

type OpenWindow = {
  appId: string;
  zIndex: number;
  minimized: boolean;
  /** 창이 처음 놓이는 자리 (계단식으로 조금씩 밀어 놓는다) */
  offset: { x: number; y: number };
};

type DesktopProps = {
  apps: Partial<Record<string, AppDefinition>>;
  tier?: TierId;
  coins?: number;
};

export function Desktop({ apps, tier = "manhattan", coins = 1500 }: DesktopProps) {
  const { theme } = useOsTheme();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [windows, setWindows] = useState<OpenWindow[]>([]);
  // z-order 카운터는 ref로 둔다. 상태 업데이터 안에서 다른 상태를 바꾸면
  // StrictMode의 이중 호출 때 값이 어긋난다.
  const zCounter = useRef(10);

  const focus = useCallback((appId: string) => {
    const next = ++zCounter.current;
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, zIndex: next, minimized: false } : w)),
    );
  }, []);

  const open = useCallback(
    (appId: string) => {
      if (!apps[appId]) return;
      const next = ++zCounter.current;

      setWindows((prev) => {
        const existing = prev.find((w) => w.appId === appId);
        // 이미 열려 있으면 앞으로 가져오고 최소화를 푼다
        if (existing) {
          return prev.map((w) =>
            w.appId === appId ? { ...w, zIndex: next, minimized: false } : w,
          );
        }
        // 창이 쌓일수록 살짝씩 어긋나게 놓아 가려지지 않게 한다
        const step = prev.length % 5;
        return [
          ...prev,
          {
            appId,
            zIndex: next,
            minimized: false,
            offset: { x: 48 + step * 34, y: 64 + step * 28 },
          },
        ];
      });
    },
    [apps],
  );

  const close = useCallback((appId: string) => {
    setWindows((prev) => prev.filter((w) => w.appId !== appId));
  }, []);

  const minimize = useCallback((appId: string) => {
    setWindows((prev) =>
      prev.map((w) => (w.appId === appId ? { ...w, minimized: true } : w)),
    );
  }, []);

  const visible = windows.filter((w) => !w.minimized);
  const frontMost = visible.reduce<OpenWindow | null>(
    (top, w) => (!top || w.zIndex > top.zIndex ? w : top),
    null,
  );
  const activeAppLabel = frontMost
    ? (apps[frontMost.appId]?.title ??
      DOCK_APPS.find((a) => a.id === frontMost.appId)?.label ??
      null)
    : null;

  return (
    <div className="relative h-dvh w-full overflow-hidden" style={{ color: "var(--os-ink)" }}>
      <SceneBackdrop scene={theme.desktop} />

      <MenuBar tier={tier} coins={coins} activeApp={activeAppLabel} />

      {/* 바탕화면: 위젯과 창이 이 영역 안에서만 움직인다 */}
      <div ref={surfaceRef} className="absolute inset-x-0 top-9 bottom-0">
        {/* 드래그 가능한 플로팅 위젯 4종 */}
        <FloatingWidget
          id="quote-win-learn"
          initial={{ x: 48, y: 148 }}
          rotate={-2.2}
          boundsRef={surfaceRef}
        >
          <QuoteCardWinLearn className="w-[300px]" />
        </FloatingWidget>

        <FloatingWidget
          id="quote-gentle-reminder"
          initial={{ x: 396, y: 118 }}
          rotate={1.6}
          boundsRef={surfaceRef}
        >
          <QuoteCardGentleReminder className="w-[330px]" />
        </FloatingWidget>

        <FloatingWidget
          id="sticker-discipline"
          initial={{ x: 796, y: 142 }}
          rotate={2.4}
          boundsRef={surfaceRef}
        >
          <PhotoSticker
            src={WIDGET_PHOTOS.discipline}
            caption="Discipline."
            tone="serif"
            fallback="linear-gradient(160deg, #f7f7f7 0%, #d8d8d8 55%, #111 55.5%, #000 100%)"
            className="h-[210px] w-[168px]"
          />
        </FloatingWidget>

        <FloatingWidget
          id="sticker-grateful"
          initial={{ x: 1006, y: 186 }}
          rotate={-1.8}
          boundsRef={surfaceRef}
        >
          <PhotoSticker
            src={WIDGET_PHOTOS.grateful}
            caption="I'm grateful to be me."
            tone="sans"
            fallback="radial-gradient(120% 90% at 70% 30%, #2BC6C6 0%, #1B4A6B 45%, #0A1526 100%)"
            className="h-[200px] w-[182px]"
          />
        </FloatingWidget>

        {/* 앱 창 */}
        <AnimatePresence>
          {visible.map((win) => {
            const app = apps[win.appId];
            if (!app) return null;
            return (
              <DesktopWindow
                key={win.appId}
                title={app.title}
                width={app.width}
                zIndex={win.zIndex}
                initial={win.offset}
                boundsRef={surfaceRef}
                onFocus={() => focus(win.appId)}
                onClose={() => close(win.appId)}
                onMinimize={() => minimize(win.appId)}
              >
                {app.render()}
              </DesktopWindow>
            );
          })}
        </AnimatePresence>
      </div>

      <Dock openApps={windows.map((w) => w.appId)} onOpen={open} />
    </div>
  );
}
