"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { motion, useMotionValue } from "framer-motion";
import { cn } from "@/lib/cn";

type FloatingWidgetProps = {
  /** 위치 저장 키 (위젯마다 고유해야 합니다) */
  id: string;
  /** 처음 배치될 위치 (px) */
  initial: { x: number; y: number };
  /** 드래그 범위를 제한할 바탕화면 영역 */
  boundsRef?: RefObject<HTMLElement | null>;
  /** 살짝 기울여 붙인 느낌 */
  rotate?: number;
  children: ReactNode;
  className?: string;
};

type Point = { x: number; y: number };

const storageKey = (id: string) => `toefl-os-widget:${id}`;

function readSaved(id: string): Point | null {
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Point>;
    if (typeof parsed?.x === "number" && Number.isFinite(parsed.x) && typeof parsed?.y === "number" && Number.isFinite(parsed.y)) {
      return { x: parsed.x, y: parsed.y };
    }
  } catch {
    // 저장소를 못 읽어도 기본 위치로 뜨면 된다.
  }
  return null;
}

/** 바탕화면 위를 자유롭게 끌어 옮길 수 있는 위젯.
 *  옮긴 위치는 브라우저에만 저장되므로(기기·사용자 간 공유 안 됨)
 *  실패해도 조용히 기본 위치로 돌아간다. */
export function FloatingWidget({
  id,
  initial,
  boundsRef,
  rotate = 0,
  children,
  className,
}: FloatingWidgetProps) {
  const initialRef = useRef(initial);
  const x = useMotionValue(initial.x);
  const y = useMotionValue(initial.y);
  const [lifted, setLifted] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  /** 바탕화면 밖으로 나가지 않도록 가둔다.
   *  초기 좌표는 큰 화면 기준이라 작은 창에서는 그대로 두면 잘려 보인다. */
  const clampToBounds = useCallback((point: Point): Point => {
    const bounds = boundsRef?.current?.getBoundingClientRect();
    const element = elementRef.current?.getBoundingClientRect();
    if (!bounds || !element) return point;

    const margin = 12;
    const maxX = Math.max(margin, bounds.width - element.width - margin);
    const maxY = Math.max(margin, bounds.height - element.height - margin);
    return {
      x: Math.min(Math.max(margin, point.x), maxX),
      y: Math.min(Math.max(margin, point.y), maxY),
    };
  }, [boundsRef]);

  // 저장된 위치는 마운트 이후에만 반영한다 (서버 렌더와 어긋나지 않게).
  useEffect(() => {
    const saved = clampToBounds(readSaved(id) ?? initialRef.current);
    x.set(saved.x);
    y.set(saved.y);
  }, [id, clampToBounds, x, y]);

  // 창 크기가 바뀌면 화면 밖으로 밀려난 위젯을 다시 끌어들인다.
  useEffect(() => {
    const onResize = () => {
      const next = clampToBounds({ x: x.get(), y: y.get() });
      x.set(next.x);
      y.set(next.y);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clampToBounds, x, y]);

  return (
    <motion.div
      ref={elementRef}
      drag
      dragMomentum={false}
      dragConstraints={boundsRef}
      dragElastic={0.04}
      initial={false}
      animate={{ rotate }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      onDragStart={() => setLifted(true)}
      onDragEnd={() => {
        setLifted(false);
        const next = clampToBounds({
          x: x.get(),
          y: y.get(),
        });
        x.set(next.x);
        y.set(next.y);
        try {
          window.localStorage.setItem(storageKey(id), JSON.stringify(next));
        } catch {
          // 저장 실패는 무시 — 이번 세션 동안은 옮긴 자리에 그대로 있다.
        }
      }}
      whileDrag={{ scale: 1.03, rotate: 0 }}
      className={cn(
        "absolute top-0 left-0 cursor-grab active:cursor-grabbing",
        lifted && "z-50",
        className,
      )}
      style={{ x, y, touchAction: "none", maxWidth: "calc(100% - 24px)" }}
    >
      {children}
    </motion.div>
  );
}
