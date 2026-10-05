"use client";

import { useEffect, useRef, useState } from "react";

// Minimal SVG chart kit following the dataviz method: one axis, thin marks,
// recessive grid, hover tooltips, text in ink tokens (never series colour).
// Palette: --viz-1 / --viz-2 (validated for light and dark surfaces).

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

export function LineChart({
  data,
  format,
  height = 220,
  target,
  band,
  marker,
  label,
  log,
}: {
  data: { label: string; value: number | null }[];
  format: (v: number) => string;
  height?: number;
  target?: { value: number; label: string };
  band?: { from: number; to: number; label: string };
  marker?: { index: number; label: string };
  label: string;
  log?: boolean;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 48, r: 12, t: 14, b: 26 };
  const iw = Math.max(0, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const vals = data.map((d) => d.value).filter((v): v is number => v !== null);
  const maxV = niceMax(Math.max(...vals, target?.value ?? 0, band?.to ?? 0));
  const minLog = 0.5;
  const y = (v: number) =>
    log ? pad.t + ih - (Math.log10(Math.max(v, minLog) / minLog) / Math.log10(maxV / minLog)) * ih : pad.t + ih - (v / maxV) * ih;
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const ticks = log ? [1, 10, 60, 360].filter((t) => t <= maxV) : [0, maxV / 2, maxV];
  let path = "";
  data.forEach((d, i) => {
    if (d.value === null) return;
    path += `${path && data[i - 1]?.value !== null ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`;
  });

  return (
    <div ref={ref} className="relative" role="img" aria-label={label}>
      {w > 0 && (
        <svg width={w} height={height} onMouseLeave={() => setHover(null)}>
          {band && <rect x={pad.l} width={iw} y={y(band.to)} height={y(band.from) - y(band.to)} fill="var(--ok)" opacity={0.09} />}
          {band && <text x={pad.l + iw - 4} y={y(band.to) + 12} textAnchor="end" fontSize="10.5" fill="var(--ok)">{band.label}</text>}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={pad.l + iw} y1={y(t)} y2={y(t)} stroke="var(--viz-grid)" />
              <text x={pad.l - 6} y={y(t) + 3.5} textAnchor="end" fontSize="10.5" fill="var(--ink-3)">{format(t)}</text>
            </g>
          ))}
          {target && (
            <g>
              <line x1={pad.l} x2={pad.l + iw} y1={y(target.value)} y2={y(target.value)} stroke="var(--ink-3)" strokeDasharray="4 4" />
              <text x={pad.l + iw - 4} y={y(target.value) - 5} textAnchor="end" fontSize="10.5" fill="var(--ink-2)">{target.label}</text>
            </g>
          )}
          {marker && (
            <g>
              <line x1={x(marker.index)} x2={x(marker.index)} y1={pad.t} y2={pad.t + ih} stroke="var(--accent)" strokeDasharray="2 3" />
              <text x={x(marker.index) + 4} y={pad.t + 10} fontSize="10.5" fill="var(--accent)">{marker.label}</text>
            </g>
          )}
          <path d={path} fill="none" stroke="var(--viz-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {data.map((d, i) =>
            d.value === null ? null : <circle key={i} cx={x(i)} cy={y(d.value)} r={hover === i ? 4.5 : 2.5} fill="var(--viz-1)" stroke="var(--surface)" strokeWidth={2} />,
          )}
          {data.map((d, i) => (i % Math.ceil(data.length / 6) === 0 || i === data.length - 1 ? <text key={i} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10.5" fill="var(--ink-3)">{d.label}</text> : null))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--line-strong)" />}
          {data.map((_, i) => (
            <rect key={i} x={x(i) - iw / data.length / 2} y={pad.t} width={iw / data.length} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
          ))}
        </svg>
      )}
      {hover !== null && data[hover] && w > 0 && (
        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-lift" style={{ left: Math.min(Math.max(x(hover) - 60, 0), w - 130), top: 0 }}>
          <p className="text-ink-3">Week to {data[hover].label}</p>
          <p className="tnum font-semibold text-ink">{data[hover].value === null ? "No data" : format(data[hover].value!)}</p>
        </div>
      )}
    </div>
  );
}

export function BarList({ items, format, label, accent }: { items: { label: string; value: number; sub?: string }[]; format: (v: number) => string; label: string; accent?: string }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div role="img" aria-label={label} className="grid gap-2.5">
      {items.map((it, i) => (
        <div key={it.label} className="grid grid-cols-[minmax(84px,120px)_1fr_auto] items-center gap-3 text-[13px]" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <span className="truncate text-ink-2">{it.label}</span>
          <div className="relative h-5">
            <div className="h-5 rounded-e-[4px] transition-opacity" style={{ width: `${Math.max(2, (it.value / max) * 100)}%`, background: accent ?? "var(--viz-1)", opacity: hover === null || hover === i ? 1 : 0.45 }} />
            {hover === i && it.sub && <span className="absolute start-0 top-6 z-10 whitespace-nowrap rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink-2 shadow-lift">{it.sub}</span>}
          </div>
          <span className="tnum text-end font-semibold text-ink">{format(it.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function SplitBar({ a, b, labels, format }: { a: number; b: number; labels: [string, string]; format: (v: number) => string }) {
  const total = Math.max(a + b, 1);
  return (
    <div>
      <div className="flex h-4 gap-[2px] overflow-hidden rounded-[4px]" role="img" aria-label={`${labels[0]} ${format(a)}, ${labels[1]} ${format(b)}`}>
        <div style={{ width: `${(a / total) * 100}%`, background: "var(--viz-1)" }} />
        <div style={{ width: `${(b / total) * 100}%`, background: "var(--viz-2)" }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-1)" }} /> {labels[0]}: <span className="tnum font-semibold text-ink">{format(a)}</span></span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--viz-2)" }} /> {labels[1]}: <span className="tnum font-semibold text-ink">{format(b)}</span></span>
      </div>
    </div>
  );
}
