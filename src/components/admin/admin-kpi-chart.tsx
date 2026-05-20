"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardComparisonMetric } from "@/lib/store";
import { formatCompactNumber, formatCurrency } from "@/lib/utils";

type AdminKpiChartProps = {
  currencySymbol: string;
  metrics: DashboardComparisonMetric[];
};

type ChartRow = {
  label: string;
  current: number;
  previous: number;
  deltaPercent: number | null;
  isCurrency: boolean;
};

function formatChartValue(value: number, isCurrency: boolean, currencySymbol: string) {
  return isCurrency ? formatCurrency(value, currencySymbol) : formatCompactNumber(value);
}

export function AdminKpiChart({ currencySymbol, metrics }: AdminKpiChartProps) {
  const chartData: ChartRow[] = metrics.map((metric) => ({
    label: metric.label,
    current: metric.currentValue,
    previous: metric.previousValue ?? 0,
    deltaPercent: metric.deltaPercent,
    isCurrency: metric.label === "Ventas",
  }));

  return (
    <article className="panel admin-chart-panel">
      <div className="admin-chart-head">
        <div>
          <p className="eyebrow">Comparativa operativa</p>
          <h3>Actividad actual vs. periodo anterior</h3>
        </div>
        <span className="trend-icon-chip">KPI</span>
      </div>

      <div className="admin-chart-frame">
        <ResponsiveContainer height="100%" width="100%">
          <BarChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(41, 44, 149, 0.08)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--muted)", fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 16,
                border: "1px solid rgba(41, 44, 149, 0.12)",
                boxShadow: "0 20px 48px rgba(17, 24, 39, 0.16)",
                background: "rgba(255, 255, 255, 0.96)",
              }}
              formatter={(value, name, item) => {
                const numericValue = typeof value === "number" ? value : Number(value ?? 0);

                return [
                  formatChartValue(numericValue, Boolean(item?.payload?.isCurrency), currencySymbol),
                  name === "current" ? "Actual" : "Previo",
                ] as const;
              }}
              labelStyle={{ color: "var(--foreground)", fontWeight: 700 }}
            />
            <Bar dataKey="previous" fill="rgba(41, 44, 149, 0.2)" radius={[10, 10, 0, 0]} />
            <Bar dataKey="current" radius={[10, 10, 0, 0]}>
              {chartData.map((row, index) => (
                <Cell
                  fill={
                    row.deltaPercent === null
                      ? "rgba(83, 96, 114, 0.45)"
                      : row.deltaPercent >= 0
                        ? "rgba(41, 44, 149, 0.92)"
                        : "rgba(197, 59, 53, 0.82)"
                  }
                  key={`${row.label}-${index}`}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="admin-chart-legend">
        {chartData.map((row) => (
          <div className="admin-chart-legend-item" key={row.label}>
            <div>
              <strong>{row.label}</strong>
              <span>Actual {formatChartValue(row.current, row.isCurrency, currencySymbol)} · previo en tooltip</span>
            </div>
            <div className="admin-chart-legend-meta">
              <span className={row.deltaPercent === null ? "is-neutral" : row.deltaPercent >= 0 ? "is-positive" : "is-negative"}>
                {row.deltaPercent === null ? "Sin base" : `${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent.toFixed(1)}%`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
