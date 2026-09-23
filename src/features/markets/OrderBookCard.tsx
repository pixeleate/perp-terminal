import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Card, SectionTitle } from '@/components/ui';
import { fetchOrderBook } from '@/lib/hyperliquid/client';
import type { OrderBookSnapshot } from '@/lib/hyperliquid/types';
import { formatPrice } from '@/lib/format';
import { colors } from '@/lib/theme';

const DEPTH = 6;
const TABULAR = { fontVariant: ['tabular-nums' as const] };
const POLL_MS = 4000;

/**
 * A real L2 read from Hyperliquid, polled rather than streamed.
 *
 * The `l2Book` websocket channel is per-coin and this screen already holds an
 * `allMids` subscription; a 4s poll is plenty for a depth ladder and keeps the
 * socket handling in one place.
 */
export function OrderBookCard({ coin }: { coin: string }) {
  const [book, setBook] = useState<OrderBookSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      try {
        const next = await fetchOrderBook(coin, controller.signal);
        if (controller.signal.aborted) return;
        setBook(next);
        setError(undefined);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : 'Order book unavailable');
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, POLL_MS);
      }
    };

    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [coin]);

  const bids = book?.bids.slice(0, DEPTH) ?? [];
  const asks = book?.asks.slice(0, DEPTH) ?? [];
  const maxSize = Math.max(...bids.map((l) => l.sz), ...asks.map((l) => l.sz), 1);

  return (
    <View>
      <SectionTitle hint={book ? `spread ${book.spreadBps.toFixed(1)} bps` : 'loading…'}>
        Order book
      </SectionTitle>
      <Card>
        {error ? (
          <Text className="font-regular text-xs text-fg-faint">{error}</Text>
        ) : (
          <View className="flex-row gap-3">
            <View className="flex-1 gap-0.5">
              {bids.map((level) => (
                <Row key={`b${level.px}`} level={level} maxSize={maxSize} tone={colors.up} align="left" />
              ))}
            </View>
            <View className="flex-1 gap-0.5">
              {asks.map((level) => (
                <Row key={`a${level.px}`} level={level} maxSize={maxSize} tone={colors.down} align="right" />
              ))}
            </View>
          </View>
        )}
      </Card>
    </View>
  );
}

function Row({
  level,
  maxSize,
  tone,
  align,
}: {
  level: { px: number; sz: number };
  maxSize: number;
  tone: string;
  align: 'left' | 'right';
}) {
  const pct = Math.min(1, level.sz / maxSize);
  return (
    <View
      className="flex-row items-center overflow-hidden py-[3px]"
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${align === 'left' ? 'Bid' : 'Ask'} ${formatPrice(level.px)}, size ${level.sz}`}
    >
      <View
        className={`absolute bottom-0 top-0 rounded-[3px] ${align === 'right' ? 'right-0' : 'left-0'}`}
        style={{ backgroundColor: `${tone}1F`, width: `${pct * 100}%` }}
      />
      <Text className="flex-1 font-semibold text-caption" style={[TABULAR, { color: tone, textAlign: align }]}>{formatPrice(level.px)}</Text>
      <Text
        className="flex-1 font-regular text-caption text-fg-faint"
        style={[TABULAR, { textAlign: align === 'left' ? 'right' : 'left' }]}
      >
        {level.sz.toFixed(4)}
      </Text>
    </View>
  );
}
