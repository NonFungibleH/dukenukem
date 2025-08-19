"use client";

import React, { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Wallet,
  Check,
  Twitter,
  Image as ImageIcon,
  Wand2,
  Sparkles,
  Download,
  Copy,
  Link2
} from "lucide-react";

// Single-file landing page. Wallet + mint are stubbed.
// Tailwind required. Replace stubs with real logic later.

export default function DukeNukemLandingPage() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState("");
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [dukeUrl, setDukeUrl] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [mintedTokenId, setMintedTokenId] = useState(null);
  const [txHash, setTxHash] = useState(null);
  const canvasRef = useRef(null);

  const canMint = connected && !!dukeUrl;

  const handleConnect = async () => {
    // TODO: integrate wagmi + RainbowKit / Reown
    setConnected(true);
    setAddress("0x7dE3...BEEF");
  };

  const onFileSelect = (f) => {
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setDukeUrl("");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
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

      // Pixelation via offscreen
      const s = document.createElement("canvas");
      const sctx = s.getContext("2d");
      const scale = 0.15;
      s.width = Math.max(8, Math.floor(W * scale));
      s.height = Math.max(8, Math.floor(H * scale));

      // Cover logic
      const ratio = Math.max(W / img.width, H / img.height);
      const sw = img.width * ratio;
      const sh = img.height * ratio;
      const sx = (W - sw) / 2;
      const sy = (H - sh) / 2;

      // Draw to small
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(
        img,
        sx / (W / s.width),
        sy / (H / s.height),
        sw / (W / s.width),
        sh / (H / s.height)
      );

      // Draw back large for chunky pixels
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s, 0, 0, s.width, s.height, 0, 0, W, H);

      // Warm/contrast tint
      ctx.globalCompositeOperation = "overlay";
      ctx.fillStyle = "rgba(255,140,0,0.18)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "multiply";
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = "source-over";

      // Scanlines
      ctx.globalAlpha = 0.25;
      for (let y = 0; y < H; y += 4) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, y, W, 2);
      }
      ctx.globalAlpha = 1;

      // Border + HUD label
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

  const handleMint = async () => {
    if (!canMint) return;
    setIsMinting(true);
    // TODO: call your contract (ethers/viem) to mint using tokenURI
    await new Promise((r) => setTimeout(r, 1400));
    const fakeId = Math.floor(Math.random() * 10000).toString();
    setMintedTokenId(fakeId);
    setTxHash("0xFAKEHASH" + fakeId.padStart(4, "0"));
    setIsMinting(false);
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      "I just minted my Duke Nukem style PFP. Come get some! #DukeNukemToken"
    );
    const url = encodeURIComponent(window.location.href);
    const intent = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    window.open(intent, "_blank");
  };

  const downloadImage = () => {
    if (!dukeUrl) return;
    const a = document.createElement("a");
    a.href = dukeUrl;
    a.download = "duke-nukem-pfp.png";
    a.click();
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-neutral-950/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-neutral-900 font-black shadow">
              DN
            </span>
            <div>
              <h1 className="text-lg font-extrabold tracking-wider">
                DUKE NUKEM TOKEN
              </h1>
              <p className="text-xs text-neutral-400 -mt-1">
                Mint your 90s-action PFP • ERC‑721
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {connected ? (
              <button className="rounded-xl bg-neutral-800 px-3 py-2 text-sm font-medium hover:bg-neutral-700 transition flex items-center gap-2">
                <Wallet className="h-4 w-4" /> {address}
              </button>
            ) : (
              <button
                onClick={handleConnect}
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900 hover:brightness-110 transition flex items-center gap-2"
              >
                <Wallet className="h-4 w-4" /> Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-10 pb-4">
        <div className="grid gap-8 lg:grid-cols-2 items-center">
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="text-4xl md:text-5xl font-black leading-tight"
            >
              Come get some.{" "}
              <span className="text-amber-400">Duke-ify</span> your PFP & mint
              the NFT.
            </motion.h2>
            <p className="mt-4 text-neutral-300 max-w-prose">
              Upload your avatar, apply the Duke treatment, then mint a
              one-of-one ERC‑721. Share it on X and flex your inner action hero.
            </p>
            <ul className="mt-6 grid grid-cols-2 gap-3 text-sm">
              {[
                { n: 1, t: "Connect wallet" },
                { n: 2, t: "Upload PFP" },
                { n: 3, t: "Generate Duke style" },
                { n: 4, t: "Mint ERC‑721" },
              ].map((s) => (
                <li key={s.n} className="flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 border border-neutral-700 text-xs font-bold">
                    {s.n}
                  </span>
                  <span>{s.t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-2xl">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                className="aspect-square w-full rounded-xl border border-dashed border-neutral-700 bg-neutral-900/60 flex items-center justify-center overflow-hidden relative"
              >
                {!previewUrl ? (
                  <div className="text-center p-10">
                    <ImageIcon className="mx-auto h-10 w-10 text-neutral-500" />
                    <p className="mt-3 text-neutral-300">
                      Drag & drop your PFP here
                    </p>
                    <p className="text-xs text-neutral-500">
                      PNG, JPG — square works best
                    </p>
                    <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-lg bg-neutral-800 px-3 py-2 text-sm hover:bg-neutral-700">
                      <Upload className="h-4 w-4" /> Choose file
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) onFileSelect(f);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <>
                    <img
                      src={previewUrl}
                      alt="preview"
                      className="absolute inset-0 h-full w-full object-cover opacity-40"
                    />
                    <canvas ref={canvasRef} className="relative z-10 h-full w-full" />
                  </>
                )}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  disabled={!previewUrl || isGenerating}
                  onClick={applyDukeStyle}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-40"
                >
                  <Wand2 className="h-4 w-4" />{" "}
                  {isGenerating ? "Generating…" : "Duke-ify PFP"}
                </button>
                <button
                  disabled={!dukeUrl}
                  onClick={downloadImage}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-40"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <button
                  disabled={!dukeUrl}
                  onClick={shareOnTwitter}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700 disabled:opacity-40"
                >
                  <Twitter className="h-4 w-4" /> Share on X
                </button>
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
              <Sparkles className="h-5 w-5 text-amber-400" /> Mint your ERC‑721
            </h3>
            <p className="mt-1 text-sm text-neutral-400">
              Name & description are optional onchain metadata. You can edit
              defaults later in your API.
            </p>
            <div className="mt-4 grid gap-3">
              <label className="text-sm">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  placeholder="Duke PFP #1"
                />
              </label>
              <label className="text-sm">
                Description
                <textarea
                  className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-amber-500"
                  rows={3}
                  placeholder="Born to kick ass and chew bubblegum."
                />
              </label>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleMint}
                disabled={!canMint || isMinting}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-neutral-900 disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />{" "}
                {isMinting ? "Minting…" : "Mint NFT"}
              </button>
              {!connected && (
                <p className="text-sm text-neutral-400">
                  Connect your wallet to mint.
                </p>
              )}
              {connected && !dukeUrl && (
                <p className="text-sm text-neutral-400">
                  Generate your Duke PFP first.
                </p>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-5">
            <h4 className="text-sm font-semibold text-neutral-300">Contract</h4>
            <p className="mt-1 text-xs text-neutral-400">Mainnet address</p>
            <div className="mt-2 flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-950 px-3 py-2">
              <code className="text-xs">0xYourERC721ContractHere</code>
              <button className="text-xs text-neutral-400 hover:text-amber-400 inline-flex items-center gap-1">
                <Copy className="h-3 w-3" />
                Copy
              </button>
            </div>
            <div className="mt-3 text-xs text-neutral-400">
              Network: Base / Ethereum (choose in wallet)
            </div>
            <div className="mt-4 h-px bg-neutral-800" />
            <h4 className="mt-4 text-sm font-semibold text-neutral-300">
              How it works
            </h4>
            <ol className="mt-2 list-decimal pl-5 text-sm text-neutral-400 space-y-1">
              <li>We style your PFP client-side (or via API) — you approve.</li>
              <li>We upload the image + JSON metadata (IPFS or your storage).</li>
              <li>We call <code>safeMint()</code> with the tokenURI.</li>
            </ol>
          </div>
        </div>

        {mintedTokenId && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 grid gap-6 lg:grid-cols-2"
          >
            <div className="rounded-2xl border border-amber-500/30 bg-neutral-900/60 p-5">
              <h3 className="text-xl font-bold flex items-center gap-2 text-amber-300">
                <Check className="h-5 w-5" /> Mint complete
              </h3>
              <p className="mt-1 text-sm text-neutral-300">
                Token ID #{mintedTokenId}
                {txHash ? (
                  <>
                    {" "}
                    • Tx <span className="font-mono text-xs">{txHash.slice(0, 10)}…</span>
                  </>
                ) : null}
              </p>
              <div className="mt-4 aspect-square overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                {dukeUrl ? (
                  <img src={dukeUrl} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full" />
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={shareOnTwitter}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
                >
                  <Twitter className="h-4 w-4" /> Share on X
                </button>
                <button
                  onClick={downloadImage}
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
                >
                  <Download className="h-4 w-4" /> Download
                </button>
                <a
                  href="#"
                  className="inline-flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700"
                >
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
                Tip: wire this UI into your stack:
                <ul className="list-disc pl-5 space-y-1 mt-2">
                  <li>Wallet: wagmi + RainbowKit / Reown</li>
                  <li>Mint: Viem/ethers write to ERC‑721 (OpenZeppelin)</li>
                  <li>Storage: IPFS via Pinata/Web3.Storage or your CDN</li>
                  <li>Image API: replace <em>applyDukeStyle()</em> with your generator</li>
                </ul>
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
            <a href="#" className="hover:text-amber-400">Contract</a>
            <a href="#" className="hover:text-amber-400">Community</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
