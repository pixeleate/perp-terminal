/**
 * Price formatting for a perps list where BTC ($87,190) and a memecoin
 * ($0.0000123) sit two rows apart. Fixed decimals look broken in both
 * directions, so scale the precision to the magnitude.
 */
export const formatPrice = (value: number | undefined): string => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  const decimals = abs >= 1000 ? 2 : abs >= 1 ? 3 : abs >= 0.01 ? 5 : 7;
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

export const formatUsd = (value: number | undefined): string =>
  value === undefined || !Number.isFinite(value) ? '—' : `$${formatPrice(value)}`;

export const formatCompactUsd = (value: number | undefined): string => {
  if (value === undefined || !Number.isFinite(value)) return '—';
  const units: [number, string][] = [
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  for (const [threshold, suffix] of units) {
    if (Math.abs(value) >= threshold) {
      return `$${(value / threshold).toFixed(2)}${suffix}`;
    }
  }
  return `$${value.toFixed(2)}`;
};

export const formatPercent = (value: number | undefined, digits = 2): string =>
  value === undefined || !Number.isFinite(value)
    ? '—'
    : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}%`;

export const toNumber = (value: string | number | undefined | null): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Truncate an address for display: 7Xq2…9fGh */
export const shortenAddress = (address: string | undefined, lead = 4, tail = 4): string => {
  if (!address) return '—';
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
};
