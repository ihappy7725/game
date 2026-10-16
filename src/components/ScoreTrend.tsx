"use client";

import { useId, useMemo } from "react";
import type { SubmissionSection, TrendPoint } from "@/lib/api";

/** 섹션별 선 색. 기존 디자인 토큰만 씁니다(accent-300~500 / signal-400). */
const SECTION_COLOR: Record<SubmissionSection, string> = {
  writing: "var(--color-accent-400)",
  speaking: "var(--color-signal-400)",
  reading: "var(--color-accent-300)",
  listening: "var(--color-accent-500)",
};

const SECTION_LABEL: Record<SubmissionSection, string> = {
  writing: "Writing",
  speaking: "Speaking",
  reading: "Reading",
  listening: "Listening",
};

// viewBox 좌표계. width="100%" 로 늘여도 비율이 유지됩니다.
const W = 720;
const H = 220;
const PAD = { top: 16, right: 16, bottom: 28, left: 34 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

/** y축 범위를 정합니다.
 *
 *  TOEFL 섹션 점수는 0~30 고정 척도지만, 실제 점수가 24~28 에 몰려 있는데
 *  0~30 을 그대로 쓰면 선이 평평해져 추세가 보이지 않습니다. 반대로 최소~최대에
 *  꽉 맞추면 1점 차이가 화면 전체를 오르내려 변화를 과장합니다.
 *  그래서 위아래 여유를 주되 최소 10점 폭은 유지하고, 0~30 밖으로는 나가지 않게 합니다.
 */
function computeDomain(values: number[]): [number, number] {
  if (values.length === 0) return [0, 30];

  const min = Math.min(...values);
  const max = Math.max(...values);

  let lo = Math.floor(min - 2);
  let hi = Math.ceil(max + 2);

  const MIN_SPAN = 10;
  if (hi - lo < MIN_SPAN) {
    const center = (hi + lo) / 2;
    lo = Math.round(center - MIN_SPAN / 2);
    hi = Math.round(center + MIN_SPAN / 2);
  }

  return [Math.max(0, lo), Math.min(30, hi)];
}

/** 격자선을 놓을 눈금 값 (범위 안에서 4~5개) */
function computeTicks([lo, hi]: [number, number]): number[] {
  const span = hi - lo;
  const step = span <= 12 ? 2 : span <= 24 ? 5 : 10;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
  return ticks;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type Props = {
  /** 백엔드 /api/stats 의 trend (오래된 것부터 정렬되어 옵니다) */
  points: TrendPoint[];
  className?: string;
};

/** 점수 추세 라인 차트 (인라인 SVG, 의존성 없음)
 *
 *  색·격자 토큰은 globals.css 에 정의되어 있고 라이트 모드 대비값도 함께
 *  들어 있으므로, 배경 밝기가 바뀌어도 격자와 축 글자가 읽힙니다.
 */
export function ScoreTrend({ points, className }: Props) {
  const gradientId = useId();

  const series = useMemo(() => {
    // estimated_score 가 null 인 점은 백엔드가 이미 걸러 주지만 한 번 더 막습니다.
    const valid = points.filter(
      (p): p is TrendPoint & { estimated_score: number } =>
        typeof p.estimated_score === "number",
    );

    const domain = computeDomain(valid.map((p) => p.estimated_score));

    // x축은 "시간"이 아니라 "제출 순서"로 둡니다. 제출 간격이 들쭉날쭉해도
    // 각 응시가 같은 폭을 차지해 추세를 읽기 쉽습니다.
    const xAt = (index: number) =>
      valid.length <= 1
        ? PAD.left + PLOT_W / 2
        : PAD.left + (index / (valid.length - 1)) * PLOT_W;

    const yAt = (score: number) => {
      const [lo, hi] = domain;
      const ratio = hi === lo ? 0.5 : (score - lo) / (hi - lo);
      return PAD.top + PLOT_H - ratio * PLOT_H;
    };

    // 섹션별로 선을 나눕니다. 전체 x 위치는 "전체 제출 순서"를 그대로 쓰므로
    // 두 섹션의 선이 같은 시간축 위에 놓입니다.
    const bySection = new Map<
      SubmissionSection,
      { x: number; y: number; score: number; createdAt: string }[]
    >();

    valid.forEach((p, index) => {
      const list = bySection.get(p.section) ?? [];
      list.push({
        x: xAt(index),
        y: yAt(p.estimated_score),
        score: p.estimated_score,
        createdAt: p.created_at,
      });
      bySection.set(p.section, list);
    });

    return { valid, domain, bySection, yAt };
  }, [points]);

  if (series.valid.length === 0) {
    return (
      <p className={className}>
        <span className="text-sm text-white/45">
          아직 점수 추세를 그릴 기록이 없습니다.
        </span>
      </p>
    );
  }

  const ticks = computeTicks(series.domain);
  const sections = [...series.bySection.keys()].sort();
  // 점이 많으면 동그라미가 선을 덮어 버리므로 일정 개수 이하에서만 찍습니다.
  const showDots = series.valid.length <= 40;

  return (
    <figure className={className}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height="auto"
        role="img"
        aria-label={`점수 추세. 제출 ${series.valid.length}건, ${series.domain[0]}점에서 ${series.domain[1]}점 사이.`}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop
              offset="0%"
              stopColor="var(--color-accent-400)"
              stopOpacity="0.28"
            />
            <stop
              offset="100%"
              stopColor="var(--color-accent-400)"
              stopOpacity="0"
            />
          </linearGradient>
        </defs>

        {/* 격자선 + y축 눈금 */}
        {ticks.map((tick) => {
          const y = series.yAt(tick);
          return (
            <g key={tick}>
              <line
                x1={PAD.left}
                y1={y}
                x2={W - PAD.right}
                y2={y}
                stroke="var(--chart-grid)"
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={PAD.left - 8}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill="var(--chart-axis-text)"
                className="font-mono"
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* 섹션별 선 */}
        {sections.map((section) => {
          const pts = series.bySection.get(section)!;
          const color = SECTION_COLOR[section];
          const line = pts.map((p) => `${p.x},${p.y}`).join(" ");

          // 면적 채움은 선이 하나일 때만 (여러 섹션이 겹치면 탁해집니다)
          const baseline = PAD.top + PLOT_H;
          const showArea = sections.length === 1 && pts.length > 1;
          const areaPath = showArea
            ? [
                `M ${pts[0].x},${baseline}`,
                ...pts.map((p) => `L ${p.x},${p.y}`),
                `L ${pts[pts.length - 1].x},${baseline}`,
                "Z",
              ].join(" ")
            : null;

          return (
            <g key={section}>
              {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}

              {pts.length > 1 ? (
                <polyline
                  points={line}
                  fill="none"
                  stroke={color}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {(showDots || pts.length === 1) &&
                pts.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={color}>
                    <title>
                      {`${SECTION_LABEL[section]} · ${formatDate(p.createdAt)} · ${p.score.toFixed(0)}점`}
                    </title>
                  </circle>
                ))}
            </g>
          );
        })}

        {/* x축 양 끝 날짜 */}
        <text
          x={PAD.left}
          y={H - 8}
          fontSize="11"
          fill="var(--chart-axis-text)"
          className="font-mono"
        >
          {formatDate(series.valid[0].created_at)}
        </text>
        {series.valid.length > 1 ? (
          <text
            x={W - PAD.right}
            y={H - 8}
            textAnchor="end"
            fontSize="11"
            fill="var(--chart-axis-text)"
            className="font-mono"
          >
            {formatDate(series.valid[series.valid.length - 1].created_at)}
          </text>
        ) : null}
      </svg>

      {/* 범례: 섹션이 둘 이상일 때만 */}
      {sections.length > 1 ? (
        <figcaption className="mt-3 flex flex-wrap items-center gap-4">
          {sections.map((section) => (
            <span
              key={section}
              className="flex items-center gap-1.5 text-xs text-white/55"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ background: SECTION_COLOR[section] }}
              />
              {SECTION_LABEL[section]}
            </span>
          ))}
        </figcaption>
      ) : null}
    </figure>
  );
}
