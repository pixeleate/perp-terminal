// Polyfills must be imported before anything touches crypto, TextEncoder or
// Buffer. Privy's Expo SDK, viem and @solana/web3.js all assume they exist.
import 'fast-text-encoding';
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
g.Buffer = g.Buffer ?? Buffer;

import 'expo-router/entry';
