import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { View } from 'react-native';

import { colors } from '@/lib/theme';

type Variant = 'line' | 'area';

const SPEC: Record<Variant, { pad: number; stroke: number; dot: number; halo: number }> = {
  // Row sparkline: 56 × 24 in the design.
  line: { pad: 3, stroke: 1.5, dot: 2, halo: 0 },
  // Trade-header chart: 132 × 56, solid area with a guide at the last price.
  area: { pad: 3, stroke: 1.6, dot: 3, halo: 6 },
};

/**
 * Non-interactive chart for list rows and the trade header. Unlike
 * `Sparkline` it has no gesture or animated state, so hundreds of instances
 * cost only a cached path each. Segments are straight, as in the design.
 */
function MiniChartComponent({
  values,
  width,
  height,
  up,
  variant = 'line',
}: {
  values: number[] | undefined;
  width: number;
  height: number;
  up: boolean;
  variant?: Variant;
}) {
  const spec = SPEC[variant];
  const color = up ? colors.up : colors.down;

  const geometry = useMemo(() => {
    if (!values || values.length < 2) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const value of values) {
      if (value < min) min = value;
      if (value > max) max = value;
    }
    const range = max - min || 1;
    const innerH = height - spec.pad * 2;
    const stepX = width / (values.length - 1);
    const points = values.map((value, index) => ({
      x: index * stepX,
      y: spec.pad + innerH - ((value - min) / range) * innerH,
    }));

    const builder = Skia.PathBuilder.Make();
    builder.moveTo(points[0]!.x, points[0]!.y);
    for (let i = 1; i < points.length; i += 1) builder.lineTo(points[i]!.x, points[i]!.y);
    const line = builder.build();
    const area = builder.lineTo(width, height).lineTo(0, height).close().detach();
    const last = points[points.length - 1]!;
    const guide = Skia.PathBuilder.Make().moveTo(0, last.y).lineTo(width, last.y).detach();

    return { line, area, guide, last };
  }, [values, width, height, spec.pad]);

  if (!geometry) {
    return <View style={{ width, height }} accessibilityElementsHidden />;
  }

  return (
    <Canvas style={{ width, height }} accessibilityElementsHidden>
      {variant === 'area' ? (
        <>
          <Path path={geometry.area} color={color} />
          <Path path={geometry.guide} style="stroke" strokeWidth={1} strokeCap="round" color={color} />
        </>
      ) : null}
      <Path
        path={geometry.line}
        style="stroke"
        strokeWidth={spec.stroke}
        strokeJoin="round"
        strokeCap="round"
        color={color}
      />
      {spec.halo > 0 ? (
        <Circle cx={geometry.last.x} cy={geometry.last.y} r={spec.halo} color={color} opacity={0.25} />
      ) : null}
      <Circle cx={geometry.last.x} cy={geometry.last.y} r={spec.dot} color={color} />
    </Canvas>
  );
}

export const MiniChart = memo(MiniChartComponent);
