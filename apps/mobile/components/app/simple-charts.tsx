import { useMemo } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

type PieSlice = {
  label: string;
  value: number;
  color: string;
};

type BarDatum = {
  label: string;
  value: number;
  color: string;
};

type LineDatum = {
  label: string;
  value: number;
};

function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number,
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(
  x: number,
  y: number,
  radius: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

export function DonutChart({
  data,
  size = 170,
  strokeWidth = 24,
}: {
  data: PieSlice[];
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let currentPercentage = 0;

  return (
    <View className="items-center">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {data.map((item) => {
          const percentage = total > 0 ? item.value / total : 0;
          const strokeDashoffset = circumference * (1 - currentPercentage);
          const strokeDasharray = `${circumference * percentage} ${circumference}`;

          currentPercentage += percentage;

          return (
            <Circle
              key={item.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={item.color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>

      <View className="mt-2 w-full gap-1">
        {data.map((item) => (
          <View key={item.label} className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <Text className="text-[12px] text-slate-600">{item.label}</Text>
            </View>
            <Text className="text-[12px] font-semibold text-slate-900">{item.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function VerticalBarChart({
  data,
  height = 170,
}: {
  data: BarDatum[];
  height?: number;
}) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);
  const width = Math.max(data.length * 54, 220);
  const barWidth = 26;
  const chartHeight = height - 30;
  const baseline = chartHeight;

  return (
    <View className="w-full">
      <Svg width={width} height={height}>
        <Line x1={0} y1={baseline} x2={width} y2={baseline} stroke="#e2e8f0" strokeWidth={1} />
        {data.map((item, index) => {
          const x = index * 54 + 16;
          const barHeight = maxValue > 0 ? (item.value / maxValue) * (chartHeight - 10) : 0;
          const y = baseline - barHeight;

          return (
            <Rect
              key={item.label}
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              fill={item.color}
              rx={6}
            />
          );
        })}
      </Svg>

      <View className="mt-2 flex-row flex-wrap gap-3">
        {data.map((item) => (
          <View key={item.label} className="flex-row items-center gap-1.5">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            <Text className="text-[11px] text-slate-600">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function LineAreaChart({
  data,
  width = 320,
  height = 180,
  color = "#16a34a",
}: {
  data: LineDatum[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const values = useMemo(() => data.map((item) => item.value), [data]);
  const maxValue = Math.max(...values, 0);
  const minValue = Math.min(...values, 0);
  const xSpacing = data.length > 1 ? (width - 24) / (data.length - 1) : width - 24;
  const yRange = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x = 12 + index * xSpacing;
    const normalized = (item.value - minValue) / yRange;
    const y = (height - 26) - normalized * (height - 52);
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1]?.x ?? 0} ${height - 26} L ${
          points[0]?.x ?? 0
        } ${height - 26} Z`
      : "";

  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={12} y1={height - 26} x2={width - 12} y2={height - 26} stroke="#e2e8f0" />
        {areaPath ? <Path d={areaPath} fill={`${color}22`} /> : null}
        {linePath ? <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" /> : null}
        {points.map((point, index) => (
          <Circle key={`${data[index]?.label}-${index}`} cx={point.x} cy={point.y} r={3.5} fill={color} />
        ))}
      </Svg>

      <View className="mt-1 flex-row flex-wrap justify-between">
        {data.map((item) => (
          <Text key={item.label} className="text-[10px] text-slate-500">
            {item.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

export function RadialProgress({
  value,
  total,
  color = "#16a34a",
  size = 84,
}: {
  value: number;
  total: number;
  color?: string;
  size?: number;
}) {
  const radius = size / 2 - 8;
  const progress = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  const endAngle = progress * 360;
  const path = describeArc(size / 2, size / 2, radius, 0, endAngle);

  return (
    <View className="items-center justify-center">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#e2e8f0"
          strokeWidth={8}
          fill="none"
        />
        {progress > 0 ? (
          <Path d={path} stroke={color} strokeWidth={8} fill="none" strokeLinecap="round" />
        ) : null}
      </Svg>
      <View className="absolute items-center">
        <Text className="text-[14px] font-semibold text-slate-900">{Math.round(progress * 100)}%</Text>
      </View>
    </View>
  );
}
