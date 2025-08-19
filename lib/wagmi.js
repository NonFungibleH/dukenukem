'use client';

import { createConfig } from 'wagmi';
import { http } from 'viem';
import { mainnet, base } from 'wagmi/chains';
import { injected, metaMask } from '@wagmi/connectors';

export const config = createConfig({
  chains: [mainnet, base],
  connectors: [
    metaMask({
      dappMetadata: {
        name: "Duke Nukem Token",              // 👈 REQUIRED
        url: "https://dukenukem.vercel.app",   // 👈 your deployed site
      },
    }),
    injected({
      shimDisconnect: true,
      dappMetadata: {
        name: "Duke Nukem Token",
        url: "https://dukenukem.vercel.app",
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
  },
  ssr: true, // helps with Next.js SSR issues
});
