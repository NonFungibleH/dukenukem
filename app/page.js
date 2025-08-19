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
import lighthouse from "@lighthouse-web3/sdk";

const CONTRACT = "0x2162924dae5b87b593fe62205f045a26edf27548"; // Sepolia

const NFT_ABI = [
  {
    "inputs":[{"internalType":"string","name":"tokenURI_","type":"string"}],
    "name":"mintNFT",
    "outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],
    "stateMutability":"payable","type":"function"
  },
  {"inputs":[],"name":"mintFee","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasMinted","outputs":[{"internalType":"bool","name":"bool","type":"bool"}],"stateMutability":"view","type":"function"},
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
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  const { data: onchainMintFee } = useReadContract({ address: CONTRACT, abi: NFT_ABI, functionName: "mintFee" });
  const { writeContract, data: txHash } = useWriteContract();
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  const [previewUrl, setPreviewUrl] = useState("");
  const [dukeUrl, setDukeUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState(null);
  const [hashForUi, setHashForUi] = useState(null);
  const canvasRef = useRef(null);

  const canMint = isConnected && !!dukeUrl;

  const onFileSelect = (f) => {
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setDukeUrl("");
    setMintedTokenId(null);
    setHashForUi(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer?.files?.[0];
    if (f && f.type.startsWith("image/")) onFileSelect(f);
  };

  const applyDukeStyle = async () => {
    if (!previewUrl || !canvasRef.current) return;
    setIsGenerating(true);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const W = 768, H = 768;
      canvas.width = W; canvas.height = H;

      const s = document.createElement("canvas");
      const sctx = s.getContext("2d");
      const scale = 0.15;
      s.width = Math.max(8, Math.floor(W * scale));
      s.height = Math.max(8, Math.floor(H * scale));

      const ratio = Math.max(W / img.width, H / img.height);
      const sw = img.width * ratio, sh = img.height * ratio;
      const sx = (W - sw) / 2, sy = (H - sh) / 2;

      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(img, sx / (W / s.width), sy / (H / s.height), sw / (W / s.width), sh / (H / s.height));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s, 0, 0, s.width, s.height, 0, 0, W, H);

      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(255,140,0,0.18)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      ctx.globalAlpha = 0.25;
      for (let y = 0; y < H; y += 4) { ctx.fillStyle = "black"; ctx.fillRect(0, y, W, 2); }
      ctx.globalAlpha = 1;

      ctx.strokeStyle = "#f59e0b";
      ctx.lineWidth = 16;
      ctx.strokeRect(8, 8, W - 16, H - 16);
      ctx.fillStyle = "#fde68a";
      ctx.font = "700 36px system-ui, -apple-system, Segoe UI, Roboto";
      ctx.fillText("DUKE MODE", 24, 56);

      const url = canvas.toDataURL("image/png");
      setDukeUrl(url);
      setIsGenerating(false);
    };
    img.src = previewUrl;
  };

  async function uploadToLighthouse({ imageDataUrl, metadata }) {
    const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY;
    if (!apiKey) throw new Error("Missing NEXT_PUBLIC_LIGHTHOUSE_API_KEY");

    const imgBlob = dataUrlToBlob(imageDataUrl);
    const imageFile = new File([imgBlob], "duke.png", { type: "image/png" });
    const imgOut = await lighthouse.upload(imageFile, apiKey);
    const imageCid = imgOut?.data?.Hash;
    if (!imageCid) throw new Error("Lighthouse image upload failed");
    const imageUri = `ipfs://${imageCid}`;

    const json = JSON.stringify({ ...metadata, image: imageUri });
    const metaOut = await lighthouse.uploadText(json, apiKey, "duke-metadata.json");
    const metaCid = metaOut?.data?.Hash;
    if (!metaCid) throw new Error("Lighthouse metadata upload failed");

    return `ipfs://${metaCid}`;
  }

  const handleMint = async () => {
    if (!canMint) return;
    try {
      setIsMinting(true);
      const tokenURI = await uploadToLighthouse({
        imageDataUrl: dukeUrl,
        metadata: {
          name: "Duke Drop",
          description: "AI-generated Duke-style PFP.",
          attributes: [{ trait_type: "Style", value: "Duke" }]
        }
      });
      const fee = (onchainMintFee ?? 0n);
      writeContract({
        address: CONTRACT,
        abi: NFT_ABI,
        functionName: "mintNFT",
        args: [tokenURI],
        value: fee,
      });
    } catch (e) {
      console.error(e);
      setIsMinting(false);
      alert(e?.message ?? String(e));
    }
  };

  useEffect(() => {
    if (!receipt || mintedTokenId !== null) return;
    try {
      let tokenId = null;
      try {
        const parsed1 = parseEventLogs({ abi: NFT_ABI, logs: receipt.logs, eventName: "NFTMinted" });
        const mine1 = parsed1.find((l) => l?.args?.owner?.toLowerCase() === address?.toLowerCase());
        if (mine1) tokenId = String(mine1.args.tokenId);
      } catch {}
      if (!tokenId) {
        const parsed2 = parseEventLogs({ abi: NFT_ABI, logs: receipt.logs, eventName: "Transfer" });
        const mine2 = parsed2.find((l) => l?.args?.to?.toLowerCase() === address?.toLowerCase());
        if (mine2) tokenId = String(mine2.args.tokenId);
      }
      if (tokenId) {
        setMintedTokenId(tokenId);
        setHashForUi(String(receipt.transactionHash));
      }
    } catch {}
    finally { setIsMinting(false); }
  }, [receipt]);

  const shareOnTwitter = () => {
    const text = encodeURIComponent("I just minted my Duke Nukem style PFP. Come get some! #DukeNukemToken");
    const url = encodeURIComponent(window.location.href);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, "_blank");
  };

  const downloadImage = () => {
    if (!dukeUrl || !mintedTokenId) return;
    const a = document.createElement("a");
    a.href = dukeUrl;
    a.download = `duke-nukem-pfp-${mintedTokenId}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between px-6 py-4 border-b border-neutral-800">
        <h1 className="text-xl font-bold text-amber-500">Duke Nukem NFT</h1>
        {!isConnected ? (
          <button
            onClick={() => connect({ connector: connectors[0] })}
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900"
          >
            <Wallet className="h-4 w-4 inline mr-1" /> Connect Wallet
          </button>
        ) : (
          <button
            onClick={() => disconnect()}
            className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700"
          >
            {address.slice(0, 6)}…{address.slice(-4)}
          </button>
        )}
      </header>

      <main className="p-6 space-y-6">
        <section
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="border-2 border-dashed border-neutral-700 p-6 rounded-xl text-center"
        >
          {!previewUrl ? (
            <div>
              <Upload className="mx-auto h-12 w-12 text-neutral-500" />
              <p className="mt-2 text-neutral-400">Drag & drop an image, or click to select</p>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                id="file-input"
                onChange={(e) => onFileSelect(e.target.files[0])}
              />
              <label htmlFor="file-input" className="cursor-pointer text-amber-500 underline">Browse</label>
            </div>
          ) : (
            <div className="space-y-3">
              <img src={previewUrl} alt="preview" className="mx-auto max-h-64 rounded-lg border border-neutral-800" />
              {!dukeUrl && (
                <button
                  onClick={applyDukeStyle}
                  disabled={isGenerating}
                  className="bg-amber-500 text-neutral-900 px-4 py-2 rounded-xl font-semibold"
                >
                  {isGenerating ? "Generating..." : "Apply Duke Style"}
                </button>
              )}
            </div>
          )}
        </section>

        <canvas ref={canvasRef} className="hidden"></canvas>

        {mintedTokenId ? (
          <section className="p-6 bg-neutral-900 rounded-xl text-center space-y-3">
            <h2 className="text-lg font-bold text-amber-500">Minted Successfully!</h2>
            <img src={dukeUrl} alt="duke" className="mx-auto max-h-64 rounded-lg border border-amber-500" />
            <div className="flex gap-3 justify-center">
              <button onClick={downloadImage} className="bg-neutral-800 px-3 py-2 rounded-xl">Download</button>
              <button onClick={shareOnTwitter} className="bg-blue-500 px-3 py-2 rounded-xl text-white">Share</button>
              <a
                href={`https://sepolia.etherscan.io/tx/${hashForUi}`}
                target="_blank"
                className="bg-neutral-800 px-3 py-2 rounded-xl"
              >
                View Tx
              </a>
            </div>
          </section>
        ) : (
          isConnected && dukeUrl && (
            <button
              onClick={handleMint}
              disabled={isMinting}
              className="w-full bg-amber-500 text-neutral-900 py-3 rounded-xl font-bold"
            >
              {isMinting ? "Minting..." : "Mint Duke NFT"}
            </button>
          )
        )}
      </main>
    </div>
  );
}


