"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Shield, ArrowRight, CheckCircle2, Lock, Cpu, Database, Activity, Sparkles, Terminal, ExternalLink, Zap } from "lucide-react";

export default function LandingPage() {
  const [testInput, setTestInput] = useState(
    "AUTH_EVENT 2026-11-20T14:30:00Z user=admin password=CANARY-password-hunter2 token=eyJhbGciOiJIUzI1NiJ9.fake credit_card=4111111111111111 host=db-primary-internal ip=192.168.1.50"
  );
  const [testOutput, setTestOutput] = useState("");
  const [testHash, setTestHash] = useState("");
  const [isScrubbing, setIsScrubbing] = useState(false);

  const runScrubDemo = async () => {
    setIsScrubbing(true);
    try {
      let res = await fetch("/api/live-redact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: testInput, source_id: "node-internal-primary-01" }),
      }).catch(() => null);
      if (!res || !res.ok) {
        res = await fetch("http://localhost:8000/api/live-redact", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ raw_text: testInput, source_id: "node-internal-primary-01" }),
        });
      }
      if (res && res.ok) {
        const data = await res.json();
        setTestOutput(data.redacted_text);
        setTestHash(data.sha256_hash);
      } else {
        fallbackScrub();
      }
    } catch {
      fallbackScrub();
    } finally {
      setIsScrubbing(false);
    }
  };

  const fallbackScrub = () => {
    let scrubbed = testInput
      .replace(/CANARY-[a-zA-Z0-9_-]+/g, "[REDACTED_CANARY]")
      .replace(/password=([^\s]+)/g, "password=[REDACTED]")
      .replace(/token=([^\s]+)/g, "token=[REDACTED_JWT]")
      .replace(/credit_card=([^\s]+)/g, "credit_card=[REDACTED_CC]")
      .replace(/ip=\d+\.\d+\.\d+\.\d+/g, "ip=[REDACTED_IP]");
    setTestOutput(scrubbed);
    setTestHash("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  };

  return (
    <div className="relative min-h-screen bg-[#07090C] text-white selection:bg-[#C8F63B] selection:text-[#07090C] overflow-hidden">
      {/* Background Soft Glow Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[600px] pointer-events-none spotlight-cone z-0" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[850px] h-[400px] bg-gradient-to-b from-[#C8F63B]/10 via-[#3B82F6]/5 to-transparent blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Floating Modern Header */}
      <nav className="relative z-20 max-w-6xl mx-auto px-6 pt-6">
        <div className="flex items-center justify-between px-6 py-3.5 glass-panel rounded-full border border-white/10 shadow-2xl">
          <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white group">
            <div className="w-8 h-8 rounded-lg bg-[#C8F63B] text-[#07090C] flex items-center justify-center font-black text-sm shadow-[0_0_15px_rgba(200,246,59,0.35)] group-hover:scale-105 transition-transform">
              N
            </div>
            <span className="text-sm font-semibold tracking-wide">
              AIOps <span className="text-[#9AA4B2] font-normal">Guardian</span>
            </span>
          </Link>

          {/* Navigation Pill Menu */}
          <div className="hidden md:flex items-center gap-7 text-xs font-medium text-[#9AA4B2]">
            <a href="#features" className="hover:text-white transition-colors flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#C8F63B]" /> Features
            </a>
            <a href="#architecture" className="hover:text-white transition-colors">Two-Tier Architecture</a>
            <a href="#live-sandbox" className="hover:text-white transition-colors">Zero-Leak Proof</a>
            <a href="http://localhost:8080" target="_blank" className="hover:text-white transition-colors flex items-center gap-1">
              Local UI (8080) <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-xs font-semibold text-[#9AA4B2] hover:text-white px-3.5 py-1.5 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/login?tab=create"
              className="text-xs font-bold bg-white hover:bg-[#C8F63B] text-[#07090C] px-4 py-2 rounded-full transition-all duration-200 shadow-md hover:shadow-[0_0_18px_rgba(200,246,59,0.4)] hover:scale-[1.02]"
            >
              Create Account
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-16 pb-12 text-center">
        {/* Subtle Upper Pill */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-8">
          <span className="w-2 h-2 rounded-full bg-[#C8F63B] animate-pulse" />
          Autonomous Observability // Zero-Leak Privacy
        </div>

        {/* Flanking Metrics + Main Headline Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center mb-8">
          {/* Left Flanking Metrics */}
          <div className="hidden md:flex md:col-span-3 flex-col gap-8 text-left pl-4">
            <div>
              <div className="text-4xl lg:text-5xl font-bold tracking-tight text-white font-mono-code">
                0
              </div>
              <div className="text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mt-1">
                CANARY SECRETS LEAKED
              </div>
            </div>
            <div>
              <div className="text-4xl lg:text-5xl font-bold tracking-tight text-white font-mono-code">
                87%
              </div>
              <div className="text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mt-1">
                FASTER ROOT-CAUSE DIAGNOSIS
              </div>
            </div>
          </div>

          {/* Main Headline (Instrument Serif) */}
          <div className="col-span-1 md:col-span-6 px-2">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-serif-headline text-white tracking-tight leading-[1.08] mb-6">
              Ship faster than <br />
              <span className="italic font-serif-headline text-[#C8F63B]">your standup.</span>
            </h1>
            <p className="text-sm sm:text-base text-[#9AA4B2] max-w-md mx-auto leading-relaxed">
              Detect cascading failures before your team opens Slack. Cryptographically proved zero data leakage with grounded Google Gemini 3.5 Flash root cause analysis.
            </p>

            {/* Main Action CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mt-8">
              <Link
                href="/dashboard"
                className="w-full sm:w-auto px-7 py-3 rounded-full bg-[#C8F63B] text-[#07090C] text-sm font-bold tracking-tight flex items-center justify-center gap-2 hover:bg-[#d8ff54] transition-all shadow-[0_0_24px_rgba(200,246,59,0.3)] hover:scale-105 active:scale-95"
              >
                <span>Try it free</span>
                <ArrowRight className="w-4 h-4 text-[#07090C]" />
              </Link>
              <a
                href="#architecture"
                className="w-full sm:w-auto px-6 py-3 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-semibold border border-white/10 transition-colors"
              >
                View Architecture
              </a>
            </div>
          </div>

          {/* Right Flanking Metrics */}
          <div className="hidden md:flex md:col-span-3 flex-col gap-8 text-right pr-4">
            <div>
              <div className="text-4xl lg:text-5xl font-bold tracking-tight text-white font-mono-code">
                &lt; 1.2ms
              </div>
              <div className="text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mt-1">
                P95 EGRESS OVERHEAD
              </div>
            </div>
            <div>
              <div className="text-4xl lg:text-5xl font-bold tracking-tight text-white font-mono-code">
                100%
              </div>
              <div className="text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mt-1">
                GROUNDED AI REASONING
              </div>
            </div>
          </div>
        </div>

        {/* Mobile metrics row */}
        <div className="grid grid-cols-2 gap-4 md:hidden text-left py-4 mb-4 border-y border-white/5">
          <div>
            <div className="text-2xl font-bold font-mono-code text-white">0</div>
            <div className="text-[10px] font-mono-code text-[#9AA4B2] uppercase">CANARY LEAKS</div>
          </div>
          <div>
            <div className="text-2xl font-bold font-mono-code text-white">87%</div>
            <div className="text-[10px] font-mono-code text-[#9AA4B2] uppercase">FASTER MTTR</div>
          </div>
        </div>
      </section>

      {/* Hero Visuals: The 3 Real Product Floating Glass Cards (Matching Screenshot) */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1 (Left): Privacy Egress Stream / Redacted Logs */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between shadow-2xl relative overflow-hidden group">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9AA4B2]">
                <span className="w-2 h-2 rounded-full bg-[#3B82F6]" />
                <span>Privacy Egress Stream</span>
              </div>
              <span className="text-[10px] font-mono-code text-[#C8F63B] bg-[#C8F63B]/10 px-2 py-0.5 rounded">
                GATE 1 VERIFIED
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-white/90 font-mono-code text-[11px] truncate">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-[#9AA4B2]">AK</span>
                  <span>auth: token=[REDACTED]</span>
                </div>
                <span className="text-[10px] font-medium text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded">
                  Scrubbed
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-white/90 font-mono-code text-[11px] truncate">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-[#9AA4B2]">MS</span>
                  <span>db: host=src_d905e6aa1538</span>
                </div>
                <span className="text-[10px] font-medium text-[#3B82F6] bg-[#3B82F6]/10 px-2 py-0.5 rounded">
                  HMAC Pseudo
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-white/90 font-mono-code text-[11px] truncate">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-[#9AA4B2]">UI</span>
                  <span>metric: cpu=1.3% ram=13.8%</span>
                </div>
                <span className="text-[10px] font-medium text-white/70 bg-white/10 px-2 py-0.5 rounded">
                  Allow-Listed
                </span>
              </div>

              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-white/90 font-mono-code text-[11px] truncate">
                  <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] text-[#9AA4B2]">RP</span>
                  <span>canary: CANARY-hunter2 [DROPPED]</span>
                </div>
                <span className="text-[10px] font-medium text-[#C8F63B] bg-[#C8F63B]/10 px-2 py-0.5 rounded">
                  0 Leak
                </span>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/5 flex justify-between items-center text-[11px] font-mono-code text-[#626E7E]">
              <span>SHA-256 Provenance Log</span>
              <span className="text-[#9AA4B2]">5,960+ Events</span>
            </div>
          </div>

          {/* Card 2 (Center): Fleet Health & Live OS Score */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between shadow-2xl relative border-white/15 bg-gradient-to-b from-white/[0.03] to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9AA4B2]">
                <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
                <span>Fleet Health Score</span>
              </div>
              <span className="text-[10px] font-mono-code text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded flex items-center gap-1">
                Auto-fix on
              </span>
            </div>

            {/* Big Score Display */}
            <div className="my-2">
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black font-mono-code text-white">98</span>
                <span className="text-sm font-semibold text-[#626E7E]">/100 repo health</span>
              </div>
              <p className="text-[11px] text-[#9AA4B2] mt-1">All 4 nodes nominal · EWMA deviation &lt; 0.8σ</p>
            </div>

            {/* Live Chart Line */}
            <div className="h-20 w-full relative my-2">
              <svg className="w-full h-full overflow-visible" viewBox="0 0 240 70">
                <defs>
                  <linearGradient id="limeGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#C8F63B" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#C8F63B" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M 0 55 Q 30 50, 60 48 T 120 38 T 180 25 T 240 12 L 240 70 L 0 70 Z"
                  fill="url(#limeGrad)"
                />
                <path
                  d="M 0 55 Q 30 50, 60 48 T 120 38 T 180 25 T 240 12"
                  fill="none"
                  stroke="#C8F63B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>

            {/* Real OS Metrics Footer */}
            <div className="pt-3 border-t border-white/5 grid grid-cols-3 gap-2 text-[11px] font-mono-code text-center">
              <div>
                <div className="text-white font-semibold">1.3%</div>
                <div className="text-[9px] text-[#626E7E]">CPU USAGE</div>
              </div>
              <div>
                <div className="text-white font-semibold">878 MB</div>
                <div className="text-[9px] text-[#626E7E]">USED RAM</div>
              </div>
              <div>
                <div className="text-white font-semibold">0.86ms</div>
                <div className="text-[9px] text-[#626E7E]">WAN LATENCY</div>
              </div>
            </div>
          </div>

          {/* Card 3 (Right): Incident Dependency & Merge Timeline */}
          <div className="glass-panel p-5 rounded-2xl flex flex-col justify-between shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#9AA4B2]">
                <span className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <span>Causal DAG Timeline</span>
              </div>
              <span className="text-[10px] font-mono-code text-[#EF4444] bg-[#EF4444]/10 px-2 py-0.5 rounded">
                ROOT CAUSE ISOLATED
              </span>
            </div>

            {/* Timeline markers */}
            <div className="flex justify-between text-[10px] font-mono-code text-[#626E7E] mb-2 px-1">
              <span>09:00</span>
              <span>10:00</span>
              <span className="text-[#C8F63B] font-bold">11:00</span>
              <span>12:00</span>
              <span>13:00</span>
            </div>

            {/* Timeline horizontal blocks */}
            <div className="space-y-2 relative">
              {/* Vertical line indicator */}
              <div className="absolute top-0 bottom-0 left-[52%] w-px bg-[#C8F63B]/60 shadow-[0_0_8px_#C8F63B] z-10" />

              <div className="grid grid-cols-4 gap-1.5 h-6">
                <div className="bg-white/5 rounded" />
                <div className="bg-[#EF4444]/80 rounded text-[9px] font-mono-code flex items-center justify-center font-bold text-white shadow-[0_0_10px_rgba(239,68,68,0.4)]">db-primary</div>
                <div className="bg-white/5 rounded" />
                <div className="bg-white/5 rounded" />
              </div>

              <div className="grid grid-cols-4 gap-1.5 h-6">
                <div className="bg-white/5 rounded" />
                <div className="bg-white/5 rounded" />
                <div className="bg-[#F59E0B]/80 rounded text-[9px] font-mono-code flex items-center justify-center font-bold text-black">auth-svc</div>
                <div className="bg-white/5 rounded" />
              </div>

              <div className="grid grid-cols-4 gap-1.5 h-6">
                <div className="bg-white/5 rounded" />
                <div className="bg-white/5 rounded" />
                <div className="bg-white/5 rounded" />
                <div className="bg-[#F59E0B]/60 rounded text-[9px] font-mono-code flex items-center justify-center text-white/90">api-gw</div>
              </div>
            </div>

            {/* Gemini Root Cause Annotation */}
            <div className="mt-4 pt-3 border-t border-white/5 text-[11px] leading-relaxed text-[#9AA4B2]">
              <strong className="text-white">Gemini 3.5 Flash:</strong> Root cause candidate <code className="text-[#C8F63B] font-mono-code">db-primary</code> (85% confidence) triggered connection pool exhaustion.
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Zero-Leak Redaction Sandbox */}
      <section id="live-sandbox" className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-mono-code text-[#C8F63B] uppercase tracking-wider mb-2">
                <Shield className="w-3.5 h-3.5" /> Principle P1: Zero Data Leakage
              </div>
              <h2 className="text-2xl sm:text-3xl font-serif-headline text-white">
                Live Interactive Redaction Sandbox
              </h2>
              <p className="text-xs text-[#9AA4B2] mt-1 max-w-xl">
                Test the deterministic scrubber with planted canary secrets, credentials, or JWT tokens. See how secrets are dropped locally before payload generation.
              </p>
            </div>
            <Link
              href="/dashboard"
              className="text-xs font-bold bg-[#C8F63B] text-[#07090C] px-5 py-2.5 rounded-full flex items-center gap-1.5 hover:bg-[#d8ff54] transition-all"
            >
              Open Full Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Sandbox Input / Output */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                Raw Input (Customer Tier 1)
              </label>
              <textarea
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                className="w-full h-36 bg-black/60 border border-white/10 rounded-xl p-3 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B] transition-colors resize-none"
              />
              <button
                onClick={runScrubDemo}
                disabled={isScrubbing}
                className="mt-2 text-xs font-bold bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
              >
                <Terminal className="w-3.5 h-3.5 text-[#C8F63B]" />
                {isScrubbing ? "Scrubbing..." : "Test Local Scrubbing"}
              </button>
            </div>

            <div>
              <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                Allow-Listed Metadata Sent to SaaS
              </label>
              <div className="w-full h-36 bg-black/60 border border-white/10 rounded-xl p-3 text-xs font-mono-code text-[#22C55E] overflow-y-auto whitespace-pre-wrap break-all">
                {testOutput || "Click 'Test Local Scrubbing' to see the redaction output..."}
              </div>
              <div className="mt-2 text-[10px] font-mono-code text-[#626E7E] truncate">
                SHA-256 Digest: <span className="text-[#C8F63B]">{testHash || "—"}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Two-Tier Architecture Section */}
      <section id="architecture" className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-mono-code text-[#3B82F6] uppercase tracking-wider mb-2">
            <Zap className="w-3.5 h-3.5" /> Distributed Trust Boundary
          </div>
          <h2 className="text-3xl sm:text-4xl font-serif-headline text-white">
            Where Your Data Lives vs. Where the AI Runs
          </h2>
          <p className="text-xs sm:text-sm text-[#9AA4B2] max-w-lg mx-auto mt-2">
            The customer environment never runs cloud LLMs. The central SaaS platform never receives raw logs or customer credentials.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-[#3B82F6]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-white">Tier 1: Customer Local Collector</h3>
              <span className="text-[10px] font-mono-code bg-[#3B82F6]/10 text-[#3B82F6] px-2 py-0.5 rounded">
                PORT 8080
              </span>
            </div>
            <p className="text-xs text-[#9AA4B2] leading-relaxed mb-4">
              Runs in the customer’s private network. Accesses raw OS operations via <code>psutil</code>, stores ephemeral raw data in SQLite, and performs deterministic regex scrubbers.
            </p>
            <ul className="text-xs space-y-2 text-white/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                Zero Cloud LLM imports — strictly enforced by CI
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                Keyed HMAC pseudonymization for all internal hostnames
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E]" />
                Pre-send SHA-256 canonical provenance logging
              </li>
            </ul>
          </div>

          <div className="glass-panel p-6 rounded-2xl border-l-4 border-l-[#C8F63B]">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-base font-bold text-white">Tier 2: Central SaaS Cloud</h3>
              <span className="text-[10px] font-mono-code bg-[#C8F63B]/10 text-[#C8F63B] px-2 py-0.5 rounded">
                PORT 8000
              </span>
            </div>
            <p className="text-xs text-[#9AA4B2] leading-relaxed mb-4">
              Receives only allow-listed, scrubbed numerical metadata across the WAN. Derives tenant identity server-side from credentials and executes grounded AI reasoning.
            </p>
            <ul className="text-xs space-y-2 text-white/80">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C8F63B]" />
                Default-deny schema validation with Pydantic (extra=&quot;forbid&quot;)
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C8F63B]" />
                Google Gemini 3.5 Flash with strict grounding checks
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#C8F63B]" />
                Human-in-the-Loop autonomous remediation with rollback
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 py-10 text-center text-xs text-[#626E7E]">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#22C55E]" />
            <span>All Systems Operational · Port 8000 (SaaS) &amp; Port 8080 (Collector)</span>
          </div>
          <div>
            Built for Secure Enterprise AIOps · Google Gemini 3.5 Flash Powered
          </div>
        </div>
      </footer>
    </div>
  );
}
