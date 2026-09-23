import {
  createPublicClient,
  formatUnits,
  getAddress,
  hashTypedData,
  http,
  isAddress,
  keccak256,
  parseUnits,
  stringToHex,
  type Address,
  type Hex,
} from 'viem';
import { arbitrum } from 'viem/chains';

import { env } from '@/lib/env';

/**
 * Hyperliquid settles on Arbitrum and signs orders as EIP-712 typed data, so
 * viem is the natural fit for the EVM side of a trading client even though this
 * spike never broadcasts anything. Everything below is offline and pure except
 * `readChainHead`, which is the one optional network call.
 */

export const USDC_DECIMALS = 6;

/** Decimal string → integer base units, without float rounding drift. */
export function toBaseUnits(amount: string, decimals = USDC_DECIMALS): bigint {
  const normalised = amount.trim() === '' || amount.trim() === '.' ? '0' : amount.trim();
  try {
    return parseUnits(normalised as `${number}`, decimals);
  } catch {
    return 0n;
  }
}

export function fromBaseUnits(amount: bigint, decimals = USDC_DECIMALS): string {
  return formatUnits(amount, decimals);
}

export function checksum(address: string): Address | null {
  return isAddress(address) ? getAddress(address) : null;
}

export type OrderIntent = {
  coin: string;
  side: 'buy' | 'sell';
  /** Size in base units of the quote asset (USDC, 6dp). */
  notional: bigint;
  limitPx: string;
  nonce: bigint;
};

/**
 * The EIP-712 digest a wallet would actually be asked to sign for this order.
 * Computing it locally is the honest half of the flow: the app can show the
 * user exactly what bytes a signature would cover without pretending to trade.
 */
export function hashOrderIntent(intent: OrderIntent): Hex {
  return hashTypedData({
    domain: {
      name: 'PerpTerminal',
      version: '1',
      chainId: arbitrum.id,
      verifyingContract: '0x0000000000000000000000000000000000000000',
    },
    types: {
      Order: [
        { name: 'coin', type: 'string' },
        { name: 'side', type: 'string' },
        { name: 'notional', type: 'uint256' },
        { name: 'limitPx', type: 'string' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'Order',
    message: {
      coin: intent.coin,
      side: intent.side,
      notional: intent.notional,
      limitPx: intent.limitPx,
      nonce: intent.nonce,
    },
  });
}

/** Deterministic client-side order id — keccak of the intent digest + nonce. */
export function clientOrderId(digest: Hex, nonce: bigint): string {
  return keccak256(stringToHex(`${digest}:${nonce}`)).slice(0, 18);
}

export type ChainHead = { blockNumber: bigint; gasPriceGwei: string; chainId: number };

/**
 * Optional: only runs when EXPO_PUBLIC_EVM_RPC_URL is set. Returns null rather
 * than throwing so the Wallet screen can render a "not configured" row.
 */
export async function readChainHead(): Promise<ChainHead | null> {
  if (!env.evmRpcUrl) return null;
  const client = createPublicClient({ chain: arbitrum, transport: http(env.evmRpcUrl) });
  const [blockNumber, gasPrice, chainId] = await Promise.all([
    client.getBlockNumber(),
    client.getGasPrice(),
    client.getChainId(),
  ]);
  return {
    blockNumber,
    gasPriceGwei: formatUnits(gasPrice, 9),
    chainId,
  };
}
