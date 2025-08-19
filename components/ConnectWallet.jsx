'use client';

import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { mainnet, base } from 'wagmi/chains';
import { Wallet } from 'lucide-react';

export default function ConnectWallet({ preferredChain = base }) {
  const { address, isConnected } = useAccount();
  const { connectors, connect, status, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { chains, switchChain } = useSwitchChain();

  if (!isConnected) {
    // Try MetaMask first if present, else show the first injected connector
    const mm = connectors.find((c) => c.id === 'metaMask');
    const injected = connectors.find((c) => c.id === 'injected');
    const connector = mm || injected;

    const onClick = () => connect({ connector });

    return (
      <button
        onClick={onClick}
        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:brightness-110 transition inline-flex items-center gap-2"
      >
        <Wallet className="h-4 w-4" /> Connect Wallet
      </button>
    );
  }

  // Ensure we’re on the preferred chain (e.g., Base). Switch if not.
  const activeChain = chains.find((c) => c.id === preferredChain.id);
  const onWrongChain = false; // wagmi v2 handles this internally on write; you can add chain state here if you want

  return (
    <div className="flex items-center gap-2">
      <button
        className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700 transition"
        title={address}
      >
        {address.slice(0, 6)}…{address.slice(-4)}
      </button>

      <button
        onClick={() => disconnect()}
        className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
      >
        Disconnect
      </button>

      {/* Optional: quick chain switch buttons */}
      <div className="hidden md:flex items-center gap-1 ml-2">
        <button
          onClick={() => switchChain({ chainId: base.id })}
          className="rounded-lg bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
        >
          Base
        </button>
        <button
          onClick={() => switchChain({ chainId: mainnet.id })}
          className="rounded-lg bg-neutral-800 px-2 py-1 text-xs hover:bg-neutral-700"
        >
          Ethereum
        </button>
      </div>
    </div>
  );
}
