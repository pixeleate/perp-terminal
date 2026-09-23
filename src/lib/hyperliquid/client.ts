import { env } from '@/lib/env';
import { toNumber } from '@/lib/format';

import type {
  HlCandle,
  HlL2Book,
  HlMetaAndAssetCtxs,
  Market,
  OrderBookSnapshot,
} from './types';

const INFO_URL = `${env.hyperliquidApiUrl}/info`;
const REQUEST_TIMEOUT_MS = 10_000;

export class HyperliquidError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'HyperliquidError';
  }
}

async function info<T>(body: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  // Compose the caller's signal with our own timeout so a hung request cannot
  // pin a screen in its loading state forever.
  const timeout = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  const composed = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await fetch(INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: composed,
    });
  } catch (cause) {
    throw new HyperliquidError(
      cause instanceof Error && cause.name === 'TimeoutError'
        ? 'Hyperliquid request timed out'
        : 'Network request to Hyperliquid failed',
    );
  }

  if (!response.ok) {
    throw new HyperliquidError(
      `Hyperliquid responded ${response.status}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

/**
 * One request gives us the whole markets screen: contract metadata plus the
 * per-asset context (prices, volume, funding). The two arrays are positional —
 * `universe[i]` describes `assetCtxs[i]`.
 */
export async function fetchMarkets(signal?: AbortSignal): Promise<Market[]> {
  const [meta, ctxs] = await info<HlMetaAndAssetCtxs>({ type: 'metaAndAssetCtxs' }, signal);

  const markets: Market[] = [];
  for (let i = 0; i < meta.universe.length; i += 1) {
    const asset = meta.universe[i];
    const ctx = ctxs[i];
    if (!asset || !ctx || asset.isDelisted) continue;

    const markPx = toNumber(ctx.markPx);
    const prevDayPx = toNumber(ctx.prevDayPx);
    if (markPx === undefined || markPx <= 0) continue;

    const midPx = toNumber(ctx.midPx) ?? markPx;
    const changePct =
      prevDayPx && prevDayPx > 0 ? ((markPx - prevDayPx) / prevDayPx) * 100 : 0;

    markets.push({
      coin: asset.name,
      markPx,
      midPx,
      prevDayPx: prevDayPx ?? markPx,
      changePct,
      dayNtlVlm: toNumber(ctx.dayNtlVlm) ?? 0,
      openInterest: toNumber(ctx.openInterest) ?? 0,
      fundingRate: toNumber(ctx.funding) ?? 0,
      maxLeverage: asset.maxLeverage,
      szDecimals: asset.szDecimals,
    });
  }

  // Hyperliquid lists 200+ perps. Sorting by 24h notional volume puts the ones
  // worth demoing at the top and keeps the tail available on scroll.
  return markets.sort((a, b) => b.dayNtlVlm - a.dayNtlVlm);
}

export async function fetchOrderBook(
  coin: string,
  signal?: AbortSignal,
): Promise<OrderBookSnapshot> {
  const book = await info<HlL2Book>({ type: 'l2Book', coin }, signal);

  const toLevels = (levels: HlL2Book['levels'][number] | undefined) =>
    (levels ?? [])
      .map((level) => ({ px: toNumber(level.px) ?? 0, sz: toNumber(level.sz) ?? 0 }))
      .filter((level) => level.px > 0);

  const bids = toLevels(book.levels[0]);
  const asks = toLevels(book.levels[1]);
  const bestBid = bids[0]?.px ?? 0;
  const bestAsk = asks[0]?.px ?? 0;
  const spread = bestAsk > 0 && bestBid > 0 ? bestAsk - bestBid : 0;
  const mid = bestAsk > 0 && bestBid > 0 ? (bestAsk + bestBid) / 2 : 0;

  return {
    coin: book.coin,
    time: book.time,
    bids,
    asks,
    spread,
    spreadBps: mid > 0 ? (spread / mid) * 10_000 : 0,
  };
}

export type CandleInterval = '5m' | '15m' | '1h' | '4h';

const INTERVAL_MS: Record<CandleInterval, number> = {
  '5m': 5 * 60_000,
  '15m': 15 * 60_000,
  '1h': 60 * 60_000,
  '4h': 4 * 60 * 60_000,
};

/**
 * Returns closes ordered oldest → newest, which is what the Skia path wants,
 * plus the high/low over the whole window for the trade header's range stats.
 */
export async function fetchCandles(
  coin: string,
  interval: CandleInterval,
  bars = 96,
  signal?: AbortSignal,
): Promise<{ closes: number[]; high?: number; low?: number; startTime: number; endTime: number }> {
  const endTime = Date.now();
  const startTime = endTime - INTERVAL_MS[interval] * bars;

  const candles = await info<HlCandle[]>(
    { type: 'candleSnapshot', req: { coin, interval, startTime, endTime } },
    signal,
  );

  const sorted = candles.slice().sort((a, b) => a.t - b.t);
  const closes: number[] = [];
  let high: number | undefined;
  let low: number | undefined;
  for (const candle of sorted) {
    const close = toNumber(candle.c);
    if (close === undefined) continue;
    closes.push(close);
    const h = toNumber(candle.h) ?? close;
    const l = toNumber(candle.l) ?? close;
    if (high === undefined || h > high) high = h;
    if (low === undefined || l < low) low = l;
  }

  return { closes, high, low, startTime, endTime };
}
