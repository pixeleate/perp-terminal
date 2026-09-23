/**
 * Hand-written types for the subset of the Hyperliquid info API this spike
 * touches. Verified against live responses from https://api.hyperliquid.xyz/info
 * rather than copied from memory — Hyperliquid returns every number as a string.
 */

export type HlUniverseAsset = {
  name: string;
  szDecimals: number;
  maxLeverage: number;
  onlyIsolated?: boolean;
  isDelisted?: boolean;
};

export type HlMeta = {
  universe: HlUniverseAsset[];
};

export type HlAssetCtx = {
  funding: string;
  openInterest: string;
  prevDayPx: string;
  dayNtlVlm: string;
  premium: string | null;
  oraclePx: string;
  markPx: string;
  midPx: string | null;
  impactPxs: [string, string] | null;
  dayBaseVlm: string;
};

/** `metaAndAssetCtxs` returns a 2-tuple, not an object. */
export type HlMetaAndAssetCtxs = [HlMeta, HlAssetCtx[]];

export type HlBookLevel = { px: string; sz: string; n: number };

export type HlL2Book = {
  coin: string;
  time: number;
  /** [bids, asks], each sorted best-first. */
  levels: [HlBookLevel[], HlBookLevel[]];
};

export type HlCandle = {
  t: number;
  T: number;
  s: string;
  i: string;
  o: string;
  c: string;
  h: string;
  l: string;
  v: string;
  n: number;
};

export type HlAllMidsMessage = {
  channel: 'allMids';
  data: { mids: Record<string, string> };
};

export type HlWsMessage =
  | HlAllMidsMessage
  | { channel: 'subscriptionResponse'; data: unknown }
  | { channel: 'pong'; data?: unknown }
  | { channel: string; data: unknown };

/** The normalised shape the UI actually renders. */
export type Market = {
  coin: string;
  markPx: number;
  midPx: number;
  prevDayPx: number;
  changePct: number;
  dayNtlVlm: number;
  openInterest: number;
  fundingRate: number;
  maxLeverage: number;
  szDecimals: number;
};

export type OrderBookSnapshot = {
  coin: string;
  time: number;
  bids: { px: number; sz: number }[];
  asks: { px: number; sz: number }[];
  spread: number;
  spreadBps: number;
};
