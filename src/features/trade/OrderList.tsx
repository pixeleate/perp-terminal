import { Text, View } from 'react-native';
import { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

import { AnimatedView } from '@/components/Styled';
import { Pill } from '@/components/ui';
import { formatPrice } from '@/lib/format';

import { SideBadge } from './SideToggle';
import type { SimulatedOrder } from './ordersStore';

const TABULAR = { fontVariant: ['tabular-nums' as const] };

function statusTone(status: SimulatedOrder['status']) {
  return status === 'filled' ? 'up' : status === 'rejected' ? 'down' : 'warn';
}

/**
 * Each row enters with a layout animation so a newly submitted order visibly
 * arrives rather than appearing between frames — the optimistic update needs to
 * be legible for the pattern to be worth anything.
 */
export function OrderList({ orders }: { orders: SimulatedOrder[] }) {
  if (orders.length === 0) {
    return (
      <View className="items-center py-6">
        <Text className="font-regular text-xs text-fg-faint">No simulated orders yet.</Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      {orders.map((order) => (
        <AnimatedView
          key={order.id}
          entering={FadeIn.duration(220)}
          exiting={FadeOut.duration(160)}
          layout={LinearTransition.springify().damping(18)}
          className="gap-1 rounded-md border border-line bg-surface p-3"
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <SideBadge side={order.side} />
              <Text className="font-semibold text-sm text-fg">{order.coin}</Text>
              <Text className="font-regular text-sm text-fg-muted" style={TABULAR}>${order.notional}</Text>
            </View>
            <Pill
              label={order.status[0]!.toUpperCase() + order.status.slice(1)}
              tone={statusTone(order.status)}
            />
          </View>

          <Text className="font-regular text-xs text-fg-muted" style={TABULAR} numberOfLines={1}>
            {order.status === 'filled' && order.fillPx !== undefined
              ? `Filled @ ${formatPrice(order.fillPx)} · slippage ${order.slippageBps!.toFixed(1)} bps`
              : order.status === 'rejected'
                ? (order.rejectReason ?? 'Rejected')
                : `Submitted @ ${formatPrice(order.refPx)} · awaiting simulated ack`}
          </Text>

          <Text className="font-mono text-2xs text-fg-faint" numberOfLines={1}>
            id {order.id} · EIP-712 {order.digest.slice(0, 14)}…
          </Text>
        </AnimatedView>
      ))}
    </View>
  );
}
