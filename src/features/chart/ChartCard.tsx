import { useMemo, useState } from 'react';
import { ActivityIndicator, Text, View, useWindowDimensions } from 'react-native';

import { PressableScale } from '@/components/PressableScale';
import { Card, SectionTitle } from '@/components/ui';
import { analytics } from '@/lib/analytics/analytics';
import { formatPercent, formatPrice } from '@/lib/format';
import type { CandleInterval } from '@/lib/hyperliquid/client';
import { useTick } from '@/lib/store/tickStore';
import { colors, space } from '@/lib/theme';

import { Sparkline } from './Sparkline';
import { useCandles } from './useCandles';

const TABULAR = { fontVariant: ['tabular-nums' as const] };

const INTERVALS: CandleInterval[] = ['5m', '15m', '1h', '4h'];

export function ChartCard({ coin }: { coin: string }) {
  const { width } = useWindowDimensions();
  const [interval, setInterval] = useState<CandleInterval>('1h');
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const { closes, loading, error } = useCandles(coin, interval);
  const tick = useTick(coin);

  // Append the live mid so the chart's right edge tracks the websocket rather
  // than the last closed candle.
  const series = useMemo(() => {
    if (closes.length === 0) return closes;
    if (!tick) return closes;
    return [...closes.slice(0, -1), tick.px];
  }, [closes, tick]);

  const first = series[0];
  const last = series[series.length - 1];
  const changePct = first && last && first > 0 ? ((last - first) / first) * 100 : 0;
  const up = changePct >= 0;

  const displayed = scrubIndex !== null ? series[scrubIndex] : last;
  // Screen gutter (20) and card padding (16) on each side.
  const chartWidth = width - 20 * 2 - space(4) * 2;
  const chartHeight = 168;

  return (
    <View>
      <SectionTitle hint={`${interval} candles`}>Chart</SectionTitle>
      <Card>
        <View className="flex-row items-start justify-between">
          <View>
            <Text className="font-semibold text-caption tracking-[0.4px] text-fg-muted">{scrubIndex !== null ? 'Scrubbed' : `${interval} close`}</Text>
            <Text className="font-semibold text-stat text-fg" style={TABULAR}>{formatPrice(displayed)}</Text>
          </View>
          <Text className="font-semibold text-sm" style={[TABULAR, { color: up ? colors.up : colors.down }]}>
            {formatPercent(changePct)}
          </Text>
        </View>

        <View className="mt-3 justify-center" style={{ height: chartHeight }}>
          {loading && series.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color={colors.accent} />
            </View>
          ) : error && series.length < 2 ? (
            <View className="flex-1 items-center justify-center">
              <Text className="text-center font-regular text-xs text-fg-faint">{error}</Text>
            </View>
          ) : (
            <Sparkline
              values={series}
              width={chartWidth}
              height={chartHeight}
              up={up}
              onScrub={setScrubIndex}
            />
          )}
        </View>

        <View className="mt-3 flex-row gap-2">
          {INTERVALS.map((candidate) => {
            const active = candidate === interval;
            return (
              <PressableScale
                key={candidate}
                scaleTo={0.94}
                onPress={() => {
                  setInterval(candidate);
                  setScrubIndex(null);
                  analytics.capture('chart_interval_changed', { coin, interval: candidate });
                }}
                className={`flex-1 items-center rounded-sm border py-2 ${
                  active ? 'border-[#FFFFFF29] bg-accent-muted' : 'border-line bg-raised'
                }`}
                accessibilityLabel={`Show ${candidate} candles`}
                accessibilityState={{ selected: active }}
              >
                <Text className={`font-semibold text-xs ${active ? 'text-accent' : 'text-fg-muted'}`}>
                  {candidate}
                </Text>
              </PressableScale>
            );
          })}
        </View>

        <Text className="mt-3 text-center font-regular text-2xs text-fg-faint">Drag across the chart to scrub · Skia + Reanimated</Text>
      </Card>
    </View>
  );
}
