export type VerificationStatus = 'pending' | 'vp_received' | 'transaction_ready' | 'minted';

export interface VerificationSession {
  id: string;
  walletAddress: string;
  status: VerificationStatus;
  vpToken?: string;
  vpHash?: string;
  issuedAtMs?: number;
  txBytes?: string;
  moveCallTarget?: string;
  txDigest?: string;
}
