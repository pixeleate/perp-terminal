import { Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';

import { env } from '@/lib/env';

/**
 * Solana on mobile, honestly.
 *
 * A real consumer app connects an external wallet: Mobile Wallet Adapter on
 * Android, or a Privy embedded Solana wallet on both platforms. MWA is
 * Android-only and an embedded wallet needs a Privy app ID and a dev client,
 * so neither is demo-able from a clean clone in Expo Go.
 *
 * What this module does instead is real ed25519 against a real RPC, with a
 * locally generated devnet keypair held in the OS keychain. The signature is
 * produced and verified with tweetnacl exactly as a wallet would; the only
 * thing being stood in for is the wallet app that holds the key. The UI labels
 * it "local devnet keypair" everywhere — it is never presented as a connection
 * to Phantom or Backpack.
 */

const SECRET_KEY_STORAGE_KEY = 'perpterminal.solana.devnet.secret';

export type SolanaKeypair = {
  publicKey: string;
  secretKey: Uint8Array;
};

export type SignedMessage = {
  message: string;
  signature: string;
  publicKey: string;
  verified: boolean;
  at: number;
};

let connection: Connection | null = null;

export function getConnection(): Connection {
  connection ??= new Connection(env.solanaRpcUrl, 'confirmed');
  return connection;
}

export const isDevnet = (): boolean => env.solanaRpcUrl.includes('devnet');

/** Loads the stored keypair, or generates and persists one on first run. */
export async function loadOrCreateKeypair(): Promise<SolanaKeypair> {
  const stored = await SecureStore.getItemAsync(SECRET_KEY_STORAGE_KEY);
  if (stored) {
    try {
      const secretKey = bs58.decode(stored);
      if (secretKey.length === nacl.sign.secretKeyLength) {
        const pair = nacl.sign.keyPair.fromSecretKey(secretKey);
        return { publicKey: bs58.encode(pair.publicKey), secretKey };
      }
    } catch {
      // Corrupt or truncated value — fall through and mint a fresh key.
    }
  }

  const pair = nacl.sign.keyPair();
  await SecureStore.setItemAsync(SECRET_KEY_STORAGE_KEY, bs58.encode(pair.secretKey));
  return { publicKey: bs58.encode(pair.publicKey), secretKey: pair.secretKey };
}

export async function forgetKeypair(): Promise<void> {
  await SecureStore.deleteItemAsync(SECRET_KEY_STORAGE_KEY);
}

/**
 * Signs UTF-8 bytes with ed25519 and verifies the result before returning it.
 * Self-verification is cheap and catches encoding mistakes at the source rather
 * than at whatever backend would have rejected the signature.
 */
export function signMessage(keypair: SolanaKeypair, message: string): SignedMessage {
  const bytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(bytes, keypair.secretKey);
  const publicKey = bs58.decode(keypair.publicKey);
  return {
    message,
    signature: bs58.encode(signature),
    publicKey: keypair.publicKey,
    verified: nacl.sign.detached.verify(bytes, signature, publicKey),
    at: Date.now(),
  };
}

/** Balance in SOL from the configured RPC. Throws on network failure. */
export async function fetchBalance(publicKey: string): Promise<number> {
  const lamports = await getConnection().getBalance(new PublicKey(publicKey));
  return lamports / LAMPORTS_PER_SOL;
}

/** Devnet faucet. Public devnet is aggressively rate limited — surface failures. */
export async function requestAirdrop(publicKey: string, sol = 0.5): Promise<string> {
  if (!isDevnet()) {
    throw new Error('Airdrop is devnet-only. Point EXPO_PUBLIC_SOLANA_RPC_URL at devnet.');
  }
  const conn = getConnection();
  const signature = await conn.requestAirdrop(
    new PublicKey(publicKey),
    Math.round(sol * LAMPORTS_PER_SOL),
  );
  const latest = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature, ...latest }, 'confirmed');
  return signature;
}

/** The message the Wallet screen asks the user to sign — SIWS-shaped. */
export function buildAuthMessage(publicKey: string, nonce: string): string {
  return [
    'PerpTerminal wants you to sign in with your Solana account:',
    publicKey,
    '',
    'This is a technical spike. No funds move and nothing is submitted on-chain.',
    '',
    `Network: ${isDevnet() ? 'devnet' : 'custom'}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n');
}
