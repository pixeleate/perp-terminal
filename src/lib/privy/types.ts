export type AuthMode = 'privy' | 'stub';

export type AuthUser = {
  id: string;
  email?: string;
  createdAt?: number;
  linkedAccounts: string[];
};

export type OtpStatus =
  | 'initial'
  | 'sending-code'
  | 'awaiting-code-input'
  | 'submitting-code'
  | 'done'
  | 'error';

export type EmbeddedWalletSummary = {
  chain: 'solana' | 'ethereum';
  address?: string;
  status: string;
};

export type AuthContextValue = {
  /** 'privy' when the real SDK is loaded and configured, 'stub' otherwise. */
  mode: AuthMode;
  /** Why we fell back to the stub — rendered verbatim in the UI. */
  stubReason?: string;
  ready: boolean;
  user: AuthUser | null;
  otpStatus: OtpStatus;
  error?: string;
  wallets: EmbeddedWalletSummary[];
  sendCode: (email: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
  createSolanaWallet: () => Promise<void>;
};
