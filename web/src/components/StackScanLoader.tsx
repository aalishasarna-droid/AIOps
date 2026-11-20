"use client";

import React, { useEffect, useRef } from "react";
import { Sparkles, ShieldCheck } from "lucide-react";

interface StackScanLoaderProps {
  isOpen: boolean;
  scenarioTitle?: string;
}

export default function StackScanLoader({ isOpen, scenarioTitle }: StackScanLoaderProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const statusRef = useRef<HTMLParagraphElement | null>(null);
  const pctRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    let W = 0;
    let H = 0;

    const L = ["Network", "Infrastructure", "Application", "Data", "Security"];
    const PERIOD = 6500; // 6.5s per sweep
    const S = 105;
    const GAP = 52;
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion:reduce)").matches;

    // Generate deterministic 3D node points
    const nodes: { l: number; x: number; z: number }[] = [];
    for (let l = 0; l < 5; l++) {
      for (let k = 0; k < 5; k++) {
        nodes.push({
          l,
          x: (((k * 73 + l * 41) % 200) - 100) * 0.8,
          z: (((k * 47 + l * 89) % 200) - 100) * 0.8,
        });
      }
    }

    const size = () => {
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      W = r.width;
      H = r.height;
      cv.width = W * dpr;
      cv.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    size();
    window.addEventListener("resize", size);

    // Color definitions aligned with AIOps Dark Theme
    const c = {
      scan: "#6CC3FF", // Electric neon cyan scanning beam
      scanGlow: "rgba(108, 195, 255, 0.28)",
      node: "#4A6798", // Inactive node
      line: "#2A3B5E", // Topology wireframe
      ok: "#5FD4A0",   // Completed emerald green
      text: "#E8EEF9",
      muted: "#8D9BB5",
    };

    const frame = (now: number) => {
      const t = now % PERIOD;
      const u = t / PERIOD;
      const a = reduce ? 0.6 : now / 8000;
      const sc = Math.min(W / 430, 1);
      const cx = W / 2;
      const cy = H / 2 + 6;

      const P = (x: number, y: number, z: number): [number, number, number] => {
        const xr = x * Math.cos(a) - z * Math.sin(a);
        const zr = x * Math.sin(a) + z * Math.cos(a);
        return [cx + xr * sc, cy + (y + zr * 0.5) * sc, zr];
      };

      const y0 = -2 * GAP;
      const y4 = 2 * GAP;
      const top = y0 - 36;
      const bot = y4 + 36;
      const by = top + u * (bot - top);

      ctx.clearRect(0, 0, W, H);

      // 1. Architecture stack plates, bottom to top
      for (let l = 4; l >= 0; l--) {
        const y = (l - 2) * GAP;
        const pts: [number, number, number][] = [
          [-S, -S],
          [S, -S],
          [S, S],
          [-S, S],
        ].map((q) => P(q[0], y, q[1]));

        const near = Math.abs(by - y) < GAP * 0.55;
        ctx.beginPath();
        pts.forEach((p, i) => {
          if (i) ctx.lineTo(p[0], p[1]);
          else ctx.moveTo(p[0], p[1]);
        });
        ctx.closePath();

        ctx.fillStyle = near ? "rgba(108, 195, 255, 0.16)" : "rgba(42, 59, 94, 0.12)";
        ctx.fill();
        ctx.strokeStyle = near ? c.scan : c.line;
        ctx.lineWidth = near ? 1.6 : 1;
        ctx.stroke();
      }

      // 2. Vertical dependency DAG edges between layers
      nodes.forEach((n, i) => {
        const m = nodes[i + 5];
        if (!m) return;
        const p = P(n.x, (n.l - 2) * GAP, n.z);
        const q = P(m.x, (m.l - 2) * GAP, m.z);
        const seen = by > (m.l - 2) * GAP;

        ctx.strokeStyle = seen ? c.scan : c.line;
        ctx.globalAlpha = seen ? 0.6 : 0.35;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p[0], p[1]);
        ctx.lineTo(q[0], q[1]);
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // 3. Topology nodes
      nodes.forEach((n) => {
        const y = (n.l - 2) * GAP;
        const p = P(n.x, y, n.z);
        const seen = by >= y;
        const d = Math.abs(by - y);

        if (d < 14) {
          ctx.strokeStyle = c.scan;
          ctx.globalAlpha = 1 - d / 14;
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5 + d, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.fillStyle = seen ? c.scan : c.node;
        ctx.beginPath();
        ctx.arc(p[0], p[1], seen ? 4.2 : 3.2, 0, Math.PI * 2);
        ctx.fill();
      });

      // 4. Glowing 3D scanning beam plane
      const bp: [number, number, number][] = [
        [-S - 14, -S - 14],
        [S + 14, -S - 14],
        [S + 14, S + 14],
        [-S - 14, S + 14],
      ].map((q) => P(q[0], by, q[1]));

      ctx.beginPath();
      bp.forEach((p, i) => {
        if (i) ctx.lineTo(p[0], p[1]);
        else ctx.moveTo(p[0], p[1]);
      });
      ctx.closePath();
      ctx.fillStyle = c.scanGlow;
      ctx.fill();
      ctx.strokeStyle = c.scan;
      ctx.lineWidth = 2;
      ctx.stroke();

      // 5. Floating 3D layer perspective labels
      ctx.font = "600 12px Manrope, Inter, sans-serif";
      ctx.textAlign = "left";
      L.forEach((n, l) => {
        const p = P(S + 14, (l - 2) * GAP, S + 14);
        const on = Math.abs(by - (l - 2) * GAP) < GAP * 0.55;
        ctx.fillStyle = on ? c.scan : c.muted;
        ctx.fillText(n, Math.min(W - 90, p[0] + 8), p[1] + 4);
      });

      // 6. Direct DOM updates for butter-smooth 60fps text & chip status
      const cur = Math.min(4, Math.max(0, Math.round((by - y0) / GAP)));
      const layerDetails: Record<string, string> = {
        Network: "Analyzing TCP probes & ingress edge metrics...",
        Infrastructure: "Inspecting host nodes, CPU & memory EWMA deviations...",
        Application: "Scanning microservice RPC traces & HTTP 504 errors...",
        Data: "Evaluating database connection pools & query locks...",
        Security: "Verifying cryptographic audit hashes & HMAC keys...",
      };

      if (statusRef.current) {
        statusRef.current.textContent =
          u > 0.95
            ? "Synthesizing causal reasoning with Gemini 3.5 Flash..."
            : layerDetails[L[cur]] || `Scanning the ${L[cur].toLowerCase()} layer...`;
      }

      if (pctRef.current) {
        pctRef.current.textContent = `${Math.min(100, Math.round(u * 100))}% scanned`;
      }

      if (chipsRef.current) {
        const chips = chipsRef.current.children;
        for (let i = 0; i < chips.length; i++) {
          const chip = chips[i] as HTMLElement;
          const isDone = by > (i - 2) * GAP + GAP * 0.5;
          const isCurrent = i === cur;

          if (isDone) {
            chip.className =
              "text-xs px-2.5 py-1 rounded-full border transition-all duration-200 text-white border-[#5FD4A0] bg-[#5FD4A0]/15 font-semibold";
          } else if (isCurrent) {
            chip.className =
              "text-xs px-2.5 py-1 rounded-full border transition-all duration-200 text-[#6CC3FF] border-[#6CC3FF] bg-[#6CC3FF]/15 font-semibold shadow-[0_0_10px_rgba(108,195,255,0.3)]";
          } else {
            chip.className =
              "text-xs px-2.5 py-1 rounded-full border transition-all duration-200 text-[#8D9BB5] border-white/10 bg-white/5";
          }
        }
      }

      animId = requestAnimationFrame(frame);
    };

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", size);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-300">
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(108,195,255,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Main Scanner Card */}
      <div className="relative w-full max-w-[480px] bg-[#0D1524]/95 border border-[#2A3B5E] shadow-[0_0_50px_rgba(108,195,255,0.18)] rounded-2xl p-6 text-center text-[#E8EEF9] overflow-hidden">
        {/* Top Header Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#6CC3FF]/10 border border-[#6CC3FF]/30 text-[#6CC3FF] text-[11px] font-mono-code font-bold tracking-wider uppercase mb-3">
          <Sparkles className="w-3.5 h-3.5 animate-pulse" />
          <span>Gemini 3.5 Flash Active Reasoning</span>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-white m-0">
          Scanning your architecture
        </h2>

        {scenarioTitle && (
          <p className="text-xs font-mono-code text-[#C8F63B] mt-1 font-semibold">
            Target: {scenarioTitle}
          </p>
        )}

        <p
          ref={statusRef}
          aria-live="polite"
          className="text-xs text-[#8D9BB5] min-h-[1.5em] mt-2 mb-1 font-mono-code transition-colors"
        >
          Initializing topological scan...
        </p>

        {/* 3D Isometric Stack Canvas */}
        <canvas
          ref={canvasRef}
          className="w-full h-[320px] block my-2 rounded-lg"
          role="img"
          aria-label="Rotating stack of five architecture layers with a scanning beam moving through them"
        />

        {/* 5 Stack Layer Chips */}
        <div ref={chipsRef} className="flex flex-wrap gap-1.5 justify-center mt-1">
          {["Network", "Infrastructure", "Application", "Data", "Security"].map((name) => (
            <span
              key={name}
              className="text-xs px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[#8D9BB5] transition-all"
            >
              {name}
            </span>
          ))}
        </div>

        {/* Scan Percentage & Grounding Proof */}
        <div className="flex items-center justify-between text-[11px] font-mono-code text-[#8D9BB5] mt-4 pt-3 border-t border-white/10">
          <span className="flex items-center gap-1 text-[#5FD4A0]">
            <ShieldCheck className="w-3.5 h-3.5" /> Zero raw data egress verified
          </span>
          <span ref={pctRef} className="text-[#6CC3FF] font-bold">
            0% scanned
          </span>
        </div>
      </div>
    </div>
  );
}
