import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  Skia,
  vec,
  type SkPath,
} from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  runOnJS,
  useDerivedValue,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { colors } from '@/lib/theme';

type Geometry = {
  line: SkPath;
  area: SkPath;
  points: { x: number; y: number }[];
  min: number;
  max: number;
};

/** Catmull-Rom-ish smoothing via cubic segments — cheap and stable for sparse data. */
function buildGeometry(values: number[], width: number, height: number, pad: number): Geometry | null {
  if (values.length < 2 || width <= 0 || height <= 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  // A perfectly flat series would divide by zero; nudge the range instead.
  if (max - min < Number.EPSILON) {
    max += Math.abs(max) * 0.001 + 1e-9;
    min -= Math.abs(min) * 0.001 + 1e-9;
  }

  const innerH = height - pad * 2;
  const stepX = width / (values.length - 1);
  const points = values.map((value, index) => ({
    x: index * stepX,
    y: pad + innerH - ((value - min) / (max - min)) * innerH,
  }));

  const builder = Skia.PathBuilder.Make();
  const first = points[0]!;
  builder.moveTo(first.x, first.y);
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1]!;
    const curr = points[i]!;
    const midX = (prev.x + curr.x) / 2;
    builder.cubicTo(midX, prev.y, midX, curr.y, curr.x, curr.y);
  }

  // build() leaves the builder intact, so the area fill continues from the line.
  const line = builder.build();
  const last = points[points.length - 1]!;
  const area = builder.lineTo(last.x, height).lineTo(first.x, height).close().detach();

  return { line, area, points, min, max };
}

export type SparklineProps = {
  values: number[];
  width: number;
  height: number;
  up: boolean;
  /** Fired on the JS thread with the scrubbed index, or null when released. */
  onScrub?: (index: number | null) => void;
};

/**
 * Skia rather than an SVG chart library for one reason that matters on a
 * trading screen: the path, the gradient and the crosshair all rasterise on the
 * render thread, so scrubbing stays at display rate while the websocket keeps
 * hammering the JS thread in the background.
 */
export function Sparkline({ values, width, height, up, onScrub }: SparklineProps) {
  const pad = 8;
  const geometry = useMemo(() => buildGeometry(values, width, height, pad), [values, width, height]);

  const scrubX: SharedValue<number> = useSharedValue(-1);
  const scrubOpacity = useSharedValue(0);

  const stroke = up ? colors.up : colors.down;

  const points = geometry?.points ?? [];
  const pointCount = points.length;

  const report = (index: number | null) => {
    onScrub?.(index);
  };

  const pan = Gesture.Pan()
    .enabled(pointCount > 1)
    .minDistance(0)
    .onBegin((event) => {
      scrubX.value = event.x;
      scrubOpacity.value = withTiming(1, { duration: 120 });
      if (onScrub) {
        const index = Math.round((event.x / width) * (pointCount - 1));
        runOnJS(report)(Math.min(pointCount - 1, Math.max(0, index)));
      }
    })
    .onUpdate((event) => {
      const clamped = Math.min(width, Math.max(0, event.x));
      scrubX.value = clamped;
      if (onScrub) {
        const index = Math.round((clamped / width) * (pointCount - 1));
        runOnJS(report)(Math.min(pointCount - 1, Math.max(0, index)));
      }
    })
    .onFinalize(() => {
      scrubOpacity.value = withTiming(0, { duration: 180 });
      scrubX.value = -1;
      if (onScrub) runOnJS(report)(null);
    });

  // Snap the crosshair to the nearest sample so the dot always sits on the line.
  const snappedX = useDerivedValue(() => {
    if (pointCount < 2 || scrubX.value < 0) return -1;
    const index = Math.round((scrubX.value / width) * (pointCount - 1));
    return points[Math.min(pointCount - 1, Math.max(0, index))]?.x ?? -1;
  });

  const snappedY = useDerivedValue(() => {
    if (pointCount < 2 || scrubX.value < 0) return -1;
    const index = Math.round((scrubX.value / width) * (pointCount - 1));
    return points[Math.min(pointCount - 1, Math.max(0, index))]?.y ?? -1;
  });

  const crosshairPath = useDerivedValue(() => {
    const builder = Skia.PathBuilder.Make();
    if (snappedX.value < 0) return builder.detach();
    return builder.moveTo(snappedX.value, 0).lineTo(snappedX.value, height).detach();
  });

  if (!geometry) {
    return <View className="rounded-md bg-raised" style={{ width, height }} />;
  }

  const lastPoint = geometry.points[geometry.points.length - 1]!;

  return (
    <GestureDetector gesture={pan}>
      <View style={{ width, height }} accessible accessibilityRole="image"
        accessibilityLabel="Price sparkline. Drag across the chart to inspect individual points.">
        <Canvas style={StyleSheet.absoluteFill}>
          <Group>
            <Path path={geometry.area}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(0, height)}
                colors={[`${stroke}55`, `${stroke}00`]}
              />
            </Path>
            <Path
              path={geometry.line}
              style="stroke"
              strokeWidth={2}
              strokeJoin="round"
              strokeCap="round"
              color={stroke}
            />
            <Circle cx={lastPoint.x} cy={lastPoint.y} r={3.5} color={stroke} />

            <Group opacity={scrubOpacity}>
              <Path path={crosshairPath} style="stroke" strokeWidth={1} color={colors.textFaint}>
                <DashPathEffect intervals={[4, 4]} />
              </Path>
              <Circle cx={snappedX} cy={snappedY} r={5} color={stroke} />
              <Circle cx={snappedX} cy={snappedY} r={5} style="stroke" strokeWidth={2} color={colors.bg} />
            </Group>
          </Group>
        </Canvas>
      </View>
    </GestureDetector>
  );
}
