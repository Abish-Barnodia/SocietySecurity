import { View } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

export type PieSlice = { label: string; value: number; color: string };

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
};

const describeSlice = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
};

// ponytail: plain trig-based SVG arcs — no charting library for one pie chart.
export default function PieChart({ data, size = 160 }: { data: PieSlice[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  if (total === 0) {
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} fill="#00000010" />
        </Svg>
      </View>
    );
  }

  // A single 100% slice degenerates the arc-path math (start === end angle),
  // so draw it as a plain circle instead.
  const nonZero = data.filter((d) => d.value > 0);
  if (nonZero.length === 1) {
    return (
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={cx} cy={cy} r={r} fill={nonZero[0].color} />
        </Svg>
      </View>
    );
  }

  let cursor = 0;
  const slices = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const startAngle = (cursor / total) * 360;
      cursor += d.value;
      const endAngle = (cursor / total) * 360;
      return { path: describeSlice(cx, cy, r, startAngle, endAngle), color: d.color, label: d.label };
    });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        {slices.map((s) => (
          <Path key={s.label} d={s.path} fill={s.color} />
        ))}
      </Svg>
    </View>
  );
}
