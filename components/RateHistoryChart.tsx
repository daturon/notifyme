"use client";

import type { RateHistoryPoint } from "@/lib/api/events";

// Мини-график последних значений rate_history (пункт 4 задания) — простой
// SVG-полилайн без сторонних библиотек, чтобы не тащить зависимость ради
// одной линии.
export function RateHistoryChart({ points }: { points: RateHistoryPoint[] }) {
  if (points.length < 2) {
    return <p className="text-sm text-zinc-500">Недостаточно данных для графика.</p>;
  }

  const width = 600;
  const height = 160;
  const padding = 24;

  const rates = points.map((p) => p.rate);
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  const range = max - min || 1;

  const stepX = (width - padding * 2) / (points.length - 1);
  const toX = (index: number) => padding + index * stepX;
  const toY = (rate: number) => height - padding - ((rate - min) / range) * (height - padding * 2);

  const linePoints = points.map((p, i) => `${toX(i)},${toY(p.rate)}`).join(" ");
  const last = points[points.length - 1];

  return (
    <div className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-xl text-zinc-900 dark:text-zinc-100"
        role="img"
        aria-label="График курса за последние дни"
      >
        <polyline points={linePoints} fill="none" stroke="currentColor" strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={p.recordedAt} cx={toX(i)} cy={toY(p.rate)} r={2.5} fill="currentColor" />
        ))}
      </svg>
      <div className="flex justify-between text-xs text-zinc-500">
        <span>
          {points[0].recordedAt} — {points[0].rate}
        </span>
        <span>
          {last.recordedAt} — {last.rate} ({last.sourceName})
        </span>
      </div>
    </div>
  );
}
