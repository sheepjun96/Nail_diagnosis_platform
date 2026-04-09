"use client";

const CHART_WIDTH = 520;
const CHART_HEIGHT = 220;
const MARGIN = { top: 16, right: 34, bottom: 34, left: 34 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function buildSegments(points) {
  const segments = [];
  let current = [];

  for (const point of points) {
    if (!point) {
      if (current.length) {
        segments.push(current);
        current = [];
      }
      continue;
    }

    current.push(point);
  }

  if (current.length) {
    segments.push(current);
  }

  return segments;
}

function buildPath(segment) {
  return segment
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(" ");
}

function formatTooltip(label, value, suffix = "") {
  if (value === null || value === undefined) {
    return `${label}: -`;
  }

  return `${label}: ${value}${suffix}`;
}

export function ProgressionChart({ rows }) {
  const chronologicalRows = [...rows].reverse();

  if (!chronologicalRows.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/45">
        선택한 손가락의 이력이 없습니다.
      </div>
    );
  }

  const xStep = chronologicalRows.length > 1 ? PLOT_WIDTH / (chronologicalRows.length - 1) : 0;
  const visibleLabelStep = chronologicalRows.length > 6 ? Math.ceil(chronologicalRows.length / 6) : 1;

  const aiPoints = chronologicalRows.map((row, index) => {
    if (row.aiSeverityScore === null || row.aiSeverityScore === undefined) {
      return null;
    }

    const x = MARGIN.left + xStep * index;
    const y = MARGIN.top + PLOT_HEIGHT * (1 - clamp(row.aiSeverityScore, 0, 100) / 100);

    return {
      x,
      y,
      value: row.aiSeverityScore,
      label: row.dateLabel,
      diagnosisLabel: row.diagnosisLabel,
    };
  });

  const napsiPoints = chronologicalRows.map((row, index) => {
    if (row.napsiTotal === null || row.napsiTotal === undefined) {
      return null;
    }

    const x = MARGIN.left + xStep * index;
    const y = MARGIN.top + PLOT_HEIGHT * (1 - clamp(row.napsiTotal, 0, 8) / 8);

    return {
      x,
      y,
      value: row.napsiTotal,
      label: row.dateLabel,
    };
  });

  const aiSegments = buildSegments(aiPoints);
  const napsiSegments = buildSegments(napsiPoints);

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4 text-xs text-white/65">
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#e74a3b]" />
          AI score (%)
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-[#4e73df]" />
          NAPSI Total
        </span>
      </div>

      <svg
        className="h-full w-full"
        preserveAspectRatio="none"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      >
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = MARGIN.top + PLOT_HEIGHT * (1 - tick / 100);

          return (
            <g key={`grid-${tick}`}>
              <line
                x1={MARGIN.left}
                x2={CHART_WIDTH - MARGIN.right}
                y1={y}
                y2={y}
                stroke="rgba(255,255,255,0.08)"
                strokeDasharray="3 4"
              />
              <text
                fill="rgba(255,255,255,0.45)"
                fontSize="10"
                textAnchor="end"
                x={MARGIN.left - 8}
                y={y + 3}
              >
                {tick}
              </text>
              <text
                fill="rgba(255,255,255,0.35)"
                fontSize="10"
                textAnchor="start"
                x={CHART_WIDTH - MARGIN.right + 8}
                y={y + 3}
              >
                {Math.round((tick / 100) * 8)}
              </text>
            </g>
          );
        })}

        <line
          x1={MARGIN.left}
          x2={CHART_WIDTH - MARGIN.right}
          y1={CHART_HEIGHT - MARGIN.bottom}
          y2={CHART_HEIGHT - MARGIN.bottom}
          stroke="rgba(255,255,255,0.18)"
        />

        {chronologicalRows.map((row, index) => {
          if (index % visibleLabelStep !== 0 && index !== chronologicalRows.length - 1) {
            return null;
          }

          const x = MARGIN.left + xStep * index;

          return (
            <text
              key={`label-${row.id}`}
              fill="rgba(255,255,255,0.5)"
              fontSize="10"
              textAnchor="middle"
              x={x}
              y={CHART_HEIGHT - 12}
            >
              {row.dateLabel}
            </text>
          );
        })}

        {aiSegments.map((segment, index) => (
          <path
            key={`ai-${index}`}
            d={buildPath(segment)}
            fill="none"
            stroke="#e74a3b"
            strokeWidth="2.5"
          />
        ))}
        {napsiSegments.map((segment, index) => (
          <path
            key={`napsi-${index}`}
            d={buildPath(segment)}
            fill="none"
            stroke="#4e73df"
            strokeWidth="2.5"
          />
        ))}

        {aiPoints.map((point, index) =>
          point ? (
            <circle
              key={`ai-point-${index}`}
              cx={point.x}
              cy={point.y}
              fill="#e74a3b"
              r="3.2"
            >
              <title>
                {`${point.label}\n${point.diagnosisLabel || "No diagnosis"}\n${formatTooltip(
                  "AI score",
                  point.value,
                  "%"
                )}`}
              </title>
            </circle>
          ) : null
        )}
        {napsiPoints.map((point, index) =>
          point ? (
            <circle
              key={`napsi-point-${index}`}
              cx={point.x}
              cy={point.y}
              fill="#4e73df"
              r="3.2"
            >
              <title>{`${point.label}\n${formatTooltip("NAPSI", point.value)}`}</title>
            </circle>
          ) : null
        )}
      </svg>
    </div>
  );
}
