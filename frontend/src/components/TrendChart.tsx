import React from "react";

export interface TrendChartDataPoint {
  date: string;
  value: number;
  isPR?: boolean;
}

interface TrendChartProps {
  data: TrendChartDataPoint[];
  label: string;
  color?: string;
  exerciseName?: string;
}

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  label,
  color = "var(--accent)",
  exerciseName,
}) => {
  // Handle empty state
  if (data.length === 0) {
    return (
      <div className="empty-state">
        <p>No sets logged for {exerciseName ? exerciseName.toLowerCase() : label.toLowerCase()} yet. Log a workout with this exercise to start tracking progress.</p>
      </div>
    );
  }

  // Handle single data point state
  if (data.length === 1) {
    return (
      <div className="card" style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ marginBottom: "12px", fontSize: "14px", color: "var(--text)" }}>
          Log this exercise in another session to see a progress trend.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>Date</p>
            <p style={{ margin: "0", fontWeight: "bold" }}>
              {new Date(data[0].date).toLocaleDateString()}
            </p>
          </div>
          <div>
            <p style={{ fontSize: "12px", color: "var(--text)", margin: "0 0 4px 0" }}>{label}</p>
            <p style={{ margin: "0", fontWeight: "bold" }}>{data[0].value.toFixed(1)}</p>
          </div>
        </div>
      </div>
    );
  }

  // Calculate chart dimensions and scaling
  const svgWidth = 600;
  const svgHeight = 240;
  const padding = { top: 20, right: 20, bottom: 20, left: 40 };
  const chartWidth = svgWidth - padding.left - padding.right;
  const chartHeight = svgHeight - padding.top - padding.bottom;

  // Calculate Y-axis scaling
  const values = data.map((d) => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue;
  const padding_value = range * 0.1 || 1; // Add 10% padding or 1 if range is 0

  const yMin = Math.max(0, minValue - padding_value);
  const yMax = maxValue + padding_value;
  const yRange = yMax - yMin;

  // Scale functions
  const xScale = (index: number) => {
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const yScale = (value: number) => {
    return padding.top + chartHeight - ((value - yMin) / yRange) * chartHeight;
  };

  // Build line path
  const points = data.map((d, i) => ({
    x: xScale(i),
    y: yScale(d.value),
    data: d,
    index: i,
  }));

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <div style={{ display: "flex", justifyContent: "center", margin: "20px 0", overflow: "auto" }}>
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        width="100%"
        height="auto"
        style={{ maxWidth: "600px", minHeight: "240px" }}
      >
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + (1 - ratio) * chartHeight;
          return (
            <line
              key={`grid-${ratio}`}
              x1={padding.left}
              y1={y}
              x2={padding.left + chartWidth}
              y2={y}
              stroke="var(--border)"
              strokeDasharray="4"
              strokeWidth="1"
            />
          );
        })}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + chartHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight}
          x2={padding.left + chartWidth}
          y2={padding.top + chartHeight}
          stroke="var(--border)"
          strokeWidth="2"
        />

        {/* Line path */}
        <path
          d={linePath}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points and PR markers */}
        {points.map((p) => (
          <g key={`point-${p.index}`}>
            {/* PR marker background (behind the dot) */}
            {p.data.isPR && (
              <circle
                cx={p.x}
                cy={p.y}
                r="8"
                fill="var(--customize-bg)"
                stroke="var(--customize)"
                strokeWidth="2"
              />
            )}

            {/* Regular dot */}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.data.isPR ? "5" : "4"}
              fill={p.data.isPR ? "var(--customize)" : color}
              stroke="white"
              strokeWidth="2"
            />

            {/* PR glyph/indicator */}
            {p.data.isPR && (
              <text
                x={p.x}
                y={p.y - 12}
                textAnchor="middle"
                fontSize="12"
                fontWeight="bold"
                fill="var(--customize)"
              >
                ★
              </text>
            )}

            {/* Tooltip via title element */}
            <title>
              {new Date(p.data.date).toLocaleDateString()}: {p.data.value.toFixed(1)}
              {p.data.isPR ? " (New PR!)" : ""}
            </title>
          </g>
        ))}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const value = yMin + ratio * yRange;
          const y = padding.top + (1 - ratio) * chartHeight;
          return (
            <text
              key={`label-${ratio}`}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="12"
              fill="var(--text)"
            >
              {value.toFixed(0)}
            </text>
          );
        })}
      </svg>
    </div>
  );
};
