import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { number } from "../../lib/api";
import { DataTable, EmptyState } from "../ui/Primitives";
export default function ResultChart({
  data = [],
  type = "bar",
  label = "Value",
  xLabel,
  yLabel,
}) {
  if (!data.length)
    return (
      <EmptyState
        title="No chart data"
        description="No observations are available for this selection."
      />
    );
  if (type === "kpi")
    return (
      <div className="py-10 text-center">
        <span className="muted">{label}</span>
        <p className="text-4xl font-semibold mt-3 mb-0 tabular-nums">
          {number(data[0].value)}
        </p>
      </div>
    );
  if (type === "table")
    return (
      <DataTable
        rows={data}
        columns={Object.keys(data[0]).map((key) => ({ key, label: key }))}
      />
    );
  const axes = (
    <>
      <CartesianGrid vertical={false} stroke="#e8edf3" />
      <XAxis
        type={type === "scatter" ? "number" : "category"}
        dataKey={type === "scatter" ? "x" : "label"}
        axisLine={false}
        tickLine={false}
        tick={{ fill: "#64748b", fontSize: 12 }}
        minTickGap={24}
        height={48}
        label={
          xLabel
            ? {
                value: xLabel,
                position: "insideBottom",
                offset: 0,
                fontSize: 12,
              }
            : undefined
        }
      />
      <YAxis
        dataKey={type === "scatter" ? "y" : undefined}
        axisLine={false}
        tickLine={false}
        width={58}
        allowDecimals={!/records|missing cells/i.test(label)}
        tick={{ fill: "#64748b", fontSize: 12 }}
        tickFormatter={(v) =>
          Intl.NumberFormat(undefined, { notation: "compact" }).format(v)
        }
        label={
          yLabel
            ? {
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                fontSize: 12,
              }
            : undefined
        }
      />
      <Tooltip
        contentStyle={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          fontSize: 13,
          color: "#111827",
        }}
        cursor={{ fill: "#f1f5f9" }}
      />
    </>
  );
  const margin = { top: 16, right: 16, left: 0, bottom: 8 };
  let chart;
  if (type === "scatter")
    chart = (
      <ScatterChart margin={margin}>
        {axes}
        <Scatter
          name={label}
          data={data}
          fill="#497ccc"
          isAnimationActive={false}
        />
      </ScatterChart>
    );
  else if (type === "line")
    chart = (
      <LineChart data={data} margin={margin}>
        {axes}
        <Line
          name={label}
          type="linear"
          dataKey="value"
          stroke="#356ac3"
          strokeWidth={2}
          dot={data.length < 20}
          isAnimationActive={false}
        />
      </LineChart>
    );
  else if (type === "area")
    chart = (
      <AreaChart data={data} margin={margin}>
        {axes}
        <Area
          name={label}
          type="linear"
          dataKey="value"
          stroke="#356ac3"
          fill="#e6eefb"
          isAnimationActive={false}
        />
      </AreaChart>
    );
  else
    chart = (
      <BarChart data={data} margin={margin}>
        {axes}
        <Bar
          name={label}
          dataKey="value"
          fill="#527fc6"
          radius={[3, 3, 0, 0]}
          maxBarSize={48}
          isAnimationActive={false}
        />
      </BarChart>
    );
  return (
    <div
      role="img"
      aria-label={`${label}: ${type} chart with ${data.length} observations`}
      className="h-[300px] w-full min-w-0"
    >
      <ResponsiveContainer width="100%" height="100%">
        {chart}
      </ResponsiveContainer>
    </div>
  );
}
