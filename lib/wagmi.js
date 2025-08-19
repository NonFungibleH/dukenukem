'use client';

import { createConfig } from 'wagmi';
import { http } from 'viem';
import { mainnet, base } from 'wagmi/chains';
import { injected, metaMask } from '@wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    metaMask(),                        // MetaMask-specific
    injected({ shimDisconnect: true }),// Fallback for any injected wallet
  ],
  transports: {
    [mainnet.id]: http(), // public RPCs; swap to your own if rate limited
    [base.id]: http(),
  },
});
