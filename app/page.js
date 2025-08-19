"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload, Wallet, Check, Twitter, Image as ImageIcon, Wand2, Sparkles,
  Download, Copy, Link2, Lock
} from "lucide-react";
import {
  useAccount, useConnect, useDisconnect, useReadContract,
  useWriteContract, useWaitForTransactionReceipt
} from "wagmi";
import { parseEventLogs } from "viem";
import lighthouse from "@lighthouse-web3/sdk"; // <-- Lighthouse SDK

// ----------------------
// Config
// ----------------------
const CONTRACT = "0x2162924dae5b87b593fe62205f045a26edf27548"; // Sepolia

// Minimal ABI (matches your contract)
const NFT_ABI = [
  {
    "inputs":[{"internalType":"string","name":"tokenURI_","type":"string"}],
    "name":"mintNFT",
    "outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],
    "stateMutability":"payable","type":"function"
  },
  {"inputs":[],"name":"mintFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasMinted","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
  {
    "anonymous":false,"inputs":[
      {"indexed":true,"internalType":"address","name":"from","type":"address"},
      {"indexed":true,"internalType":"address","name":"to","type":"address"},
      {"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"}
    ],"name":"Transfer","type":"event"
  },
  {
    "anonymous":false,"inputs":[
      {"indexed":true,"internalType":"address","name":"owner","type":"address"},
      {"indexed":true,"internalType":"uint256","name":"tokenId","type":"uint256"},
      {"indexed":false,"internalType":"string","name":"uri","type":"string"}
    ],"name":"NFTMinted","type":"event"
  }
];

// --- Utils ---
function dataUrlToBlob(dataUrl) {
  const [hdr, b64] = dataUrl.split(",");
  const mimeMatch = hdr.match(/data:(.*?);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export default function DukeNukemLandingPage() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  const [imageUrl, setImageUrl] = useState(null);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [mintedTokenId, setMintedTokenId] = useState(null);
  const [mintedTokenURI, setMintedTokenURI] = useState(null);

  const { data: mintFee } = useReadContract({
    address: CONTRACT,
    abi: NFT_ABI,
    functionName: "mintFee",
  });

  const { data: hasMinted } = useReadContract({
    address: CONTRACT,
    abi: NFT_ABI,
    functionName: "hasMinted",
    args: [address],
  });

  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: txHash });

  // After mint confirm, parse logs for tokenId + URI
  useEffect(() => {
    if (!isConfirmed) return;
    async function fetchEvents() {
      try {
        const receipt = await fetch(`/api/tx/${txHash}`).then(r => r.json());
        const logs = parseEventLogs({ abi: NFT_ABI, logs: receipt.logs });
        const minted = logs.find(l => l.eventName === "NFTMinted");
        if (minted) {
          setMintedTokenId(minted.args.tokenId.toString());
          setMintedTokenURI(minted.args.uri);
          setGeneratedImage(minted.args.uri); // assume image is at same URI
        }
      } catch (e) {
        console.error("Error fetching events", e);
      }
    }
    fetchEvents();
  }, [isConfirmed, txHash]);

  const handleMint = async () => {
    if (!generatedImage) return;
    try {
      const blob = dataUrlToBlob(generatedImage);
      const file = new File([blob], "duke.png", { type: "image/png" });

      const output = await lighthouse.upload([file], process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY);
      const ipfsHash = output.data.Hash;
      const tokenURI = `https://gateway.lighthouse.storage/ipfs/${ipfsHash}`;

      writeContract({
        address: CONTRACT,
        abi: NFT_ABI,
        functionName: "mintNFT",
        args: [tokenURI],
        value: mintFee,
      });
    } catch (err) {
      console.error("Mint error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Header */}
      <header className="flex justify-between p-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold">Duke Nukem NFT</h1>
        {isConnected ? (
          <button onClick={() => disconnect()} className="px-3 py-1 bg-red-600 rounded">
            Disconnect
          </button>
        ) : (
          connectors.map(conn => (
            <button key={conn.id} onClick={() => connect({ connector: conn })} className="px-3 py-1 bg-green-600 rounded">
              Connect {conn.name}
            </button>
          ))
        )}
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 py-12 text-center">
        <h2 className="text-3xl font-bold">Mint your Duke Nukem NFT</h2>
        <p className="mt-2 text-neutral-400">Unique AI-generated Duke Nukem style PFPs.</p>
      </section>

      {/* Mint Panel */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            {generatedImage ? (
              <img src={generatedImage} alt="Generated Duke" className="rounded-xl w-full" />
            ) : (
              <div className="flex h-64 items-center justify-center border border-dashed border-neutral-700 rounded-xl">
                <span className="text-neutral-500">No image generated</span>
              </div>
            )}

            <button
              disabled={isPending || isConfirming || hasMinted}
              onClick={handleMint}
              className="mt-4 px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded text-black font-semibold"
            >
              {isPending || isConfirming ? "Minting..." : hasMinted ? "Already Minted" : "Mint Duke NFT"}
            </button>

            {isConfirmed && (
              <div className="mt-4 text-green-400">
                ✅ Minted successfully! Token #{mintedTokenId}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h4 className="text-sm font-semibold text-neutral-300">Contract</h4>
            <p className="mt-1 text-xs text-neutral-400">Sepolia address</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
              <a href={`https://sepolia.etherscan.io/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="text-xs hover:text-amber-400">
                {CONTRACT}
              </a>
              <button onClick={() => navigator.clipboard.writeText(CONTRACT)} className="text-xs text-neutral-400 hover:text-amber-400 inline-flex items-center gap-1">
                <Copy className="h-3 w-3" /> Copy
              </button>
            </div>
            <div className="mt-3 text-xs text-neutral-400">Network: Sepolia (switch in your wallet)</div>
            <div className="mt-4 h-px bg-neutral-800" />
            <h4 className="mt-4 text-sm font-semibold text-neutral-300">How it works</h4>
            <ol className="mt-2 list-decimal pl-5 text-sm text-neutral-400 space-y-1">
              <li>We prepare your PFP (kept hidden pre-mint).</li>
              <li>Upload image + JSON metadata to IPFS via Lighthouse.</li> {/* ✅ fixed */}
              <li>Call <code>mintNFT(tokenURI)</code>.</li>
            </ol>
          </div>
        </div>

        {/* Post-mint reveal card */}
        {mintedTokenId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h4 className="text-sm font-semibold text-neutral-300">Your Duke Nukem NFT</h4>
              {generatedImage && <img src={generatedImage} alt="Minted Duke" className="mt-2 rounded-xl w-full" />}
              <div className="mt-3 text-sm text-neutral-400">Token #{mintedTokenId}</div>
              <div className="mt-3 flex gap-2">
                <a href={`https://twitter.com/intent/tweet?text=I%20just%20minted%20a%20Duke%20Nukem%20NFT!&url=${mintedTokenURI}`} target="_blank" rel="noreferrer" className="px-3 py-1 bg-sky-500 rounded text-white text-sm flex items-center gap-1">
                  <Twitter className="h-4 w-4" /> Share
                </a>
                <a href={generatedImage} download className="px-3 py-1 bg-neutral-800 rounded text-sm flex items-center gap-1">
                  <Download className="h-4 w-4" /> Download
                </a>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
              <h4 className="text-sm font-semibold text-neutral-300">Next steps</h4>
              <ul className="mt-2 space-y-2 text-sm text-neutral-300">
                <li>• Airdrop a few to early community members.</li>
                <li>• Run a meme contest: best Duke caption wins.</li>
                <li>• Add allowlist + onchain royalties if desired.</li>
              </ul>
              <div className="mt-6 text-xs text-neutral-400">
                Tip: Lighthouse has encryption/token-gating add-ons if you want to evolve this later. {/* ✅ fixed */}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 p-4 text-center text-neutral-500 text-sm">
        Built with wagmi, Lighthouse, and Next.js
      </footer>
    </div>
  );
}
