import { useSyncExternalStore } from 'react';

import { analytics } from '@/lib/analytics/analytics';
import { clientOrderId, hashOrderIntent, toBaseUnits } from '@/lib/evm/viem';
import { addBreadcrumb } from '@/lib/observability/sentry';
import { tickStore } from '@/lib/store/tickStore';

export type OrderSide = 'buy' | 'sell';
export type OrderStatus = 'pending' | 'filled' | 'rejected';

export type SimulatedOrder = {
  id: string;
  coin: string;
  side: OrderSide;
  /** USDC notional as a decimal string, exactly as typed. */
  notional: string;
  /** Mid price at submit time. */
  refPx: number;
  fillPx?: number;
  slippageBps?: number;
  status: OrderStatus;
  rejectReason?: string;
  /** Worst adverse slippage the user accepted, in bps. */
  maxSlippageBps?: number;
  /** EIP-712 digest a wallet would be asked to sign — computed with viem. */
  digest: string;
  submittedAt: number;
  settledAt?: number;
};

type Listener = () => void;

const SETTLE_DELAY_MS = 900;
const MAX_ORDERS = 20;

/** Paper margin the ticket trades against. Nothing here is a real balance. */
export const PAPER_BALANCE_USDC = 10_000;

/**
 * Optimistic order state.
 *
 * NOTHING here is sent anywhere. The order appears as `pending` the instant the
 * user confirms — which is the interaction worth proving on mobile — and then
 * resolves against the live Hyperliquid mid a beat later. Slippage is the real
 * difference between the mid at submit and the mid at settle, so the number on
 * screen is derived from real market movement even though the fill is not real.
 */
class OrdersStore {
  private orders: SimulatedOrder[] = [];
  private readonly listeners = new Set<Listener>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private nonce = 0n;
  /** USDC committed by live (pending or filled) orders. Refunded on rejection. */
  private committed = 0;

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getOrders = (): SimulatedOrder[] => this.orders;

  getAvailable = (): number => Math.max(0, PAPER_BALANCE_USDC - this.committed);

  submit = (input: {
    coin: string;
    side: OrderSide;
    notional: string;
    maxSlippageBps?: number;
  }): SimulatedOrder => {
    this.nonce += 1n;
    const refPx = tickStore.getPrice(input.coin) ?? 0;
    const notionalBaseUnits = toBaseUnits(input.notional);

    const digest = hashOrderIntent({
      coin: input.coin,
      side: input.side,
      notional: notionalBaseUnits,
      limitPx: refPx.toString(),
      nonce: this.nonce,
    });

    const order: SimulatedOrder = {
      id: clientOrderId(digest, this.nonce),
      coin: input.coin,
      side: input.side,
      notional: input.notional,
      refPx,
      status: 'pending',
      maxSlippageBps: input.maxSlippageBps,
      digest,
      submittedAt: Date.now(),
    };

    // Both sides draw on the same margin: a sell is a short on a perp.
    this.committed += Number.parseFloat(input.notional) || 0;

    this.orders = [order, ...this.orders].slice(0, MAX_ORDERS);
    this.notify();

    analytics.capture('order_submitted', {
      coin: order.coin,
      side: order.side,
      notional: order.notional,
      simulated: true,
    });
    addBreadcrumb('trade', 'order submitted', { coin: order.coin, side: order.side });

    const timer = setTimeout(() => {
      this.timers.delete(timer);
      this.settle(order.id);
    }, SETTLE_DELAY_MS);
    this.timers.add(timer);

    return order;
  };

  private settle = (id: string): void => {
    const existing = this.orders.find((order) => order.id === id);
    if (!existing || existing.status !== 'pending') return;

    const settlePx = tickStore.getPrice(existing.coin);
    if (!settlePx || !existing.refPx) {
      this.refund(existing);
      this.patch(id, {
        status: 'rejected',
        rejectReason: 'No live price at settle time',
        settledAt: Date.now(),
      });
      analytics.capture('order_rejected', { coin: existing.coin, reason: 'no_price' });
      return;
    }

    const signed = existing.side === 'buy' ? 1 : -1;
    const slippageBps = ((settlePx - existing.refPx) / existing.refPx) * 10_000 * signed;

    if (existing.maxSlippageBps !== undefined && slippageBps > existing.maxSlippageBps) {
      this.refund(existing);
      this.patch(id, {
        status: 'rejected',
        slippageBps,
        rejectReason: `Slippage ${slippageBps.toFixed(1)} bps exceeded max ${existing.maxSlippageBps} bps`,
        settledAt: Date.now(),
      });
      analytics.capture('order_rejected', { coin: existing.coin, reason: 'slippage' });
      return;
    }

    this.patch(id, {
      status: 'filled',
      fillPx: settlePx,
      slippageBps,
      settledAt: Date.now(),
    });
    analytics.capture('order_filled', {
      coin: existing.coin,
      side: existing.side,
      slippage_bps: Number(slippageBps.toFixed(2)),
      simulated: true,
    });
  };

  private refund = (order: SimulatedOrder): void => {
    this.committed = Math.max(0, this.committed - (Number.parseFloat(order.notional) || 0));
  };

  private patch = (id: string, patch: Partial<SimulatedOrder>): void => {
    this.orders = this.orders.map((order) => (order.id === id ? { ...order, ...patch } : order));
    this.notify();
  };

  clear = (): void => {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.orders = [];
    this.committed = 0;
    this.notify();
  };

  private notify = (): void => {
    this.listeners.forEach((listener) => listener());
  };
}

export const ordersStore = new OrdersStore();

export function useOrders(): SimulatedOrder[] {
  return useSyncExternalStore(ordersStore.subscribe, ordersStore.getOrders, ordersStore.getOrders);
}

/** Re-renders with the order list, which is the only thing that moves the balance. */
export function useAvailableUsdc(): number {
  useOrders();
  return ordersStore.getAvailable();
}

export function useOrdersForCoin(coin: string): SimulatedOrder[] {
  const orders = useOrders();
  return orders.filter((order) => order.coin === coin);
}
