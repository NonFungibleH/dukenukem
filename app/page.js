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
  // wagmi wallet state
  const { address, isConnected } = useAccount();
  const { connectors, connect } = useConnect();
  const { disconnect } = useDisconnect();

  // chain IO
  const { data: onchainMintFee } = useReadContract({ address: CONTRACT, abi: NFT_ABI, functionName: "mintFee" });
  const { writeContract, data: txHash, isPending, error: writeErr } = useWriteContract();
  const { data: receipt, isLoading: waiting } = useWaitForTransactionReceipt({ hash: txHash });

  // image + mint state
  const [previewUrl, setPreviewUrl] = useState("");
  const [dukeUrl, setDukeUrl] = useState(""); // prepared but hidden pre-mint
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState(null);
  const [hashForUi, setHashForUi] = useState(null);
  const canvasRef = useRef(null);

  const canMint = isConnected && !!dukeUrl;

  // File select / drag-drop
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

  // Prepare “Duke style” into offscreen canvas; hold as dataURL (hidden pre-mint)
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

      // cover fit
      const ratio = Math.max(W / img.width, H / img.height);
      const sw = img.width * ratio, sh = img.height * ratio;
      const sx = (W - sw) / 2, sy = (H - sh) / 2;

      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(
        img,
        sx / (W / s.width),
        sy / (H / s.height),
        sw / (W / s.width),
        sh / (H / s.height)
      );

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s, 0, 0, s.width, s.height, 0, 0, W, H);

      // tint + scanlines
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
      setDukeUrl(url); // prepared but NOT shown until mint
      setIsGenerating(false);
    };
    img.src = previewUrl;
  };

  // --- Lighthouse uploads (Browser SDK) ---
  // Docs: upload file (browser) & upload text/JSON. :contentReference[oaicite:1]{index=1}
  async function uploadToLighthouse({ imageDataUrl, metadata }) {
    const apiKey = process.env.NEXT_PUBLIC_LIGHTHOUSE_API_KEY;
    if (!apiKey) throw new Error("Missing NEXT_PUBLIC_LIGHTHOUSE_API_KEY");

    // 1) Image -> File -> Lighthouse.upload
    const imgBlob = dataUrlToBlob(imageDataUrl);
    const imageFile = new File([imgBlob], "duke.png", { type: "image/png" });
    const progress = () => {}; // optional: show % using progressData
    const imgOut = await lighthouse.upload(imageFile, apiKey, false, progress);
    const imageCid = imgOut?.data?.Hash;
    if (!imageCid) throw new Error("Lighthouse image upload failed");
    const imageUri = `ipfs://${imageCid}`;

    // 2) Metadata JSON -> lighthouse.uploadText (name is optional)
    const json = JSON.stringify({ ...metadata, image: imageUri });
    const metaOut = await lighthouse.uploadText(json, apiKey, "duke-metadata.json");
    const metaCid = metaOut?.data?.Hash;
    if (!metaCid) throw new Error("Lighthouse metadata upload failed");

    return `ipfs://${metaCid}`;
  }

  // Mint: upload via Lighthouse, then call mintNFT(tokenURI)
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
      // receipt effect handles reveal
    } catch (e) {
      console.error(e);
      setIsMinting(false);
      alert(e?.message ?? String(e));
    }
  };

  // When tx confirms, extract tokenId and reveal UI
  useEffect(() => {
    if (!receipt || mintedTokenId !== null) return;
    try {
      let tokenId = null;
      // Prefer our own NFTMinted event
      try {
        const parsed1 = parseEventLogs({ abi: NFT_ABI, logs: receipt.logs, eventName: "NFTMinted" });
        const mine1 = parsed1.find((l) => l?.args?.owner?.toLowerCase() === address?.toLowerCase());
        if (mine1) tokenId = String(mine1.args.tokenId);
      } catch {}
      // Fallback to Transfer
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-neutral-900 font-black shadow">DN</span>
            <div>
              <h1 className="text-lg font-extrabold tracking-wider">DUKE NUKEM TOKEN</h1>
              <p className="text-xs text-neutral-400 -mt-1">Mint your 90s-action PFP • ERC-721 (Sepolia)</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!isConnected ? (
              <button
                onClick={() => {
                  const mm = connectors.find((c) => c.id === "metaMask");
                  const injected = connectors.find((c) => c.id === "injected");
                  connect({ connector: mm || injected || connectors[0] });
                }}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:brightness-110 transition flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" /> Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700 transition">
                  {address?.slice(0, 6)}…{address?.slice(-4)}
                </button>
                <button onClick={() => disconnect()} className="rounded-xl bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700">
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-4">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl font-black leading-tight">
              Come get some. <span className="text-amber-400">Duke-ify</span> your PFP & mint the NFT.
            </motion.h2>
            <p className="mt-4 text-neutral-300 max-w-prose">
              Upload your avatar, prepare the Duke treatment, then mint a one-of-one ERC-721. Reveal + share after mint.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {[{n:1,t:"Connect wallet"},{n:2,t:"Upload PFP"},{n:3,t:"Generate Duke style (hidden)"},{n:4,t:"Mint to reveal"}].map((s)=>(
                <li key={s.n} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold">{s.n}</span>
                  <span>{s.t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Upload / Preview Card */}
          <div className="relative">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-2xl">
              <div onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}
                   className="aspect-square w-full rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 flex items-center justify-center overflow-hidden relative">
                {!previewUrl ? (
                  <div className="text-center p-10">
                    <ImageIcon className="mx-auto h-10 w-10 text-neutral-500" />
                    <p className="mt-3 text-neutral-300">Drag & drop your PFP here</p>
                    <p className="text-xs text-neutral-500">PNG, JPG — square works best</p>
                    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700">
                      <Upload className="h-4 w-4" /> Choose file
                      <input type="file" accept="image/*" className="hidden"
                             onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileSelect(f); }} />
                    </label>
                  </div>
                ) : (
                  <>
                    {/* Pre-mint: only original (dimmed) with lock */}
                    <img src={previewUrl} alt="preview" className="absolute inset-0 h-full w-full object-cover opacity-50"/>
                    {!mintedTokenId && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-neutral-950/50 backdrop-blur-sm">
                        <Lock className="h-8 w-8 text-amber-400" />
                        <p className="text-sm text-neutral-300">Mint to reveal <span className="text-amber-300 font-semibold">DUKE MODE</span></p>
                      </div>
                    )}
                    {/* After mint: reveal styled image */}
                    {mintedTokenId ? (<img src={dukeUrl} className="absolute inset-0 h-full w-full object-cover z-10" />) : null}
                    {/* keep canvas off-DOM pre-mint */}
                    <canvas ref={canvasRef} className="hidden" />
                  </>
                )}
              </div>

              {/* Actions under the card */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={!previewUrl || isGenerating}
                  onClick={applyDukeStyle}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-40"
                  title="Prepares the Duke look, but keeps it hidden until mint"
                >
                  <Wand2 className="h-4 w-4" /> {isGenerating ? "Preparing…" : "Prepare Duke Style"}
                </button>

                {/* Share/Download only AFTER mint */}
                {mintedTokenId && dukeUrl ? (
                  <>
                    <button onClick={downloadImage} className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
                      <Download className="h-4 w-4" /> Download
                    </button>
                    <button onClick={shareOnTwitter} className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
                      <Twitter className="h-4 w-4" /> Share on X
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mint Panel */}
      <section className="mx-auto max-w-6xl px-4 pb-20">
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-400" /> Mint your ERC-721
            </h3>
            <p className="mt-1 text-sm text-neutral-400">Prepare your image first, then mint to reveal the Duke version.</p>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleMint}
                disabled={!canMint || isPending || waiting || isMinting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-neutral-900 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                {isPending ? "Confirm in wallet…" : (waiting || isMinting) ? "Minting…" : "Mint NFT to Reveal"}
              </button>
              {!isConnected && (<p className="text-sm text-neutral-400">Connect your wallet to mint.</p>)}
              {isConnected && !dukeUrl && (<p className="text-sm text-neutral-400">Prepare Duke style first.</p>)}
            </div>
            {writeErr && (
              <p className="mt-2 text-xs text-red-400">
                {String(writeErr?.shortMessage ?? writeErr?.message ?? writeErr)}
              </p>
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
              <li>Upload image + JSON metadata to IPFS via Lighthouse. :contentReference[oaicite:2]{index=2}</li>
              <li>Call <code>mintNFT(tokenURI)</code>.</li>
            </ol>
          </div>
        </div>

        {/* Post-mint reveal card */}
        {mintedTokenId && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/60 p-5">
              <h3 className="text-xl font-bold flex items-center gap-2 text-amber-300">
                <Check className="h-5 w-5" /> Mint complete — Revealed!
              </h3>
              <p className="mt-1 text-sm text-neutral-300">
                Token ID #{mintedTokenId}
                {hashForUi ? (
                  <> • Tx{" "}
                    <a className="underline hover:text-amber-300 font-mono text-xs" target="_blank" rel="noreferrer"
                       href={`https://sepolia.etherscan.io/tx/${hashForUi}`}>
                      {hashForUi.slice(0, 10)}…
                    </a>
                  </>
                ) : null}
              </p>
              <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                {dukeUrl ? (<img src={dukeUrl} className="h-full w-full object-cover" />) : (<div className="h-full w-full" />)}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={shareOnTwitter} className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
                  <Twitter className="h-4 w-4" /> Share on X
                </button>
                <button onClick={downloadImage} className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
                  <Download className="h-4 w-4" /> Download
                </button>
                <a href={`https://sepolia.etherscan.io/tx/${hashForUi ?? ""}`} target="_blank" rel="noreferrer"
                   className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
                  <Link2 className="h-4 w-4" /> View on Explorer
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
                Tip: Lighthouse has encryption/token-gating add-ons if you want to evolve this later. :contentReference[oaicite:3]{index=3}
              </div>
            </div>
          </motion.div>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-neutral-800 py-8">
        <div className="mx-auto max-w-6xl px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-neutral-400">
          <p>© {new Date().getFullYear()} Duke Nukem Token — fan-made homage. Not affiliated with the original IP.</p>
          <div className="flex items-center gap-4">
            <a href="#" className="hover:text-amber-400">Docs</a>
            <a href={`https://sepolia.etherscan.io/address/${CONTRACT}`} target="_blank" rel="noreferrer" className="hover:text-amber-400">Contract</a>
            <a href="#" className="hover:text-amber-400">Community</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
