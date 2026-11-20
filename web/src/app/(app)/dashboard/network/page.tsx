"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Wifi, AlertTriangle, CheckCircle2, ArrowRight, RotateCcw,
  Terminal, Zap, RefreshCw, Loader2, Sparkles, Brain, Copy, Check, Radio, Bug, Shield
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTenant } from "@/context/TenantContext";
import StackScanLoader from "@/components/StackScanLoader";

export default function NetworkStudioPage() {
  const { currentTenant } = useTenant();

  // Network Anomaly & Dev Console Tester State
  const [networkLog, setNetworkLog] = useState<string>(
    "POST /api/v1/orders HTTP/1.1 -> 504 Gateway Timeout (upstream request timed out after 10000ms)"
  );
  const [networkUrl, setNetworkUrl] = useState<string>("/api/v1/orders");
  const [networkStatus, setNetworkStatus] = useState<number>(504);
  const [networkErrorType, setNetworkErrorType] = useState<string>("GatewayTimeout");
  const [isAnalyzingNetwork, setIsAnalyzingNetwork] = useState<boolean>(false);
  const [networkAnalysisResult, setNetworkAnalysisResult] = useState<any>(null);
  const [capturedConsoleLogs, setCapturedConsoleLogs] = useState<
    Array<{ ts: string; level: "error" | "warn" | "info"; msg: string }>
  >([
    {
      ts: "02:40:12.814",
      level: "error",
      msg: "[FetchError] POST https://api.acmefinancial.com/api/v1/orders net::ERR_CONNECTION_TIMED_OUT 504 (Gateway Timeout)",
    },
    {
      ts: "02:40:12.816",
      level: "warn",
      msg: "[NetworkRetry] Attempt 1/3 failed for upstream proxy (ingress-proxy:443)",
    },
  ]);
  const [copiedFixIndex, setCopiedFixIndex] = useState<number | null>(null);
  const [activePresetId, setActivePresetId] = useState<string>("504");

  const handleCopyFix = (text: string, index: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedFixIndex(index);
      setTimeout(() => setCopiedFixIndex(null), 2000);
    }
  };

  const handleLoadPreset = (preset: {
    id: string;
    type: string;
    url: string;
    status: number;
    message: string;
    consoleMsg: string;
  }) => {
    setActivePresetId(preset.id);
    setNetworkErrorType(preset.type);
    setNetworkUrl(preset.url);
    setNetworkStatus(preset.status);
    setNetworkLog(preset.message);
    const ts = new Date().toTimeString().split(" ")[0] + "." + Math.floor(Math.random() * 900 + 100);
    setCapturedConsoleLogs((prev) => [
      { ts, level: "error", msg: preset.consoleMsg },
      ...prev.slice(0, 5),
    ]);
    handleAnalyzeNetworkError({
      error_type: preset.type,
      url: preset.url,
      status: preset.status,
      message: preset.message,
    });
  };

  const handleSimulateBrowserNetworkFault = async (type: "504" | "502" | "403") => {
    setIsAnalyzingNetwork(true);
    setActivePresetId(type);
    const ts = new Date().toTimeString().split(" ")[0] + "." + Math.floor(Math.random() * 900 + 100);

    try {
      const res = await apiFetch(`/api/simulate-network-error?error_code=${type}&error_type=${type === "403" ? "cors" : type === "502" ? "bad_gateway" : "timeout"}`);
      const errJson = await res.json().catch(() => ({}));
      const errorMsg = errJson.message || `HTTP ${res.status}: Intentional simulated network fault`;
      setNetworkStatus(res.status);
      setNetworkUrl(`/api/v1/orders`);
      setNetworkErrorType(res.status === 504 ? "GatewayTimeout" : res.status === 502 ? "BadGateway" : "CORSBlock");
      setNetworkLog(`${errJson.error || "Network Error"}: ${errorMsg}`);
      setCapturedConsoleLogs((prev) => [
        { ts, level: "error", msg: `[DevConsole Intercept] ${res.status} ${errJson.error || "Network Error"} on ${errJson.target || "/api/v1/orders"}: ${errorMsg}` },
        ...prev.slice(0, 5),
      ]);
      await handleAnalyzeNetworkError({
        error_type: res.status === 504 ? "GatewayTimeout" : res.status === 502 ? "BadGateway" : "CORSBlock",
        url: errJson.target || "/api/v1/orders",
        status: res.status,
        message: errorMsg,
      });
    } catch (err: any) {
      setCapturedConsoleLogs((prev) => [
        { ts, level: "error", msg: `[Browser Network Error] ${err?.message || "Failed to fetch"}` },
        ...prev.slice(0, 5),
      ]);
      await handleAnalyzeNetworkError({
        error_type: "NetworkFetchFailure",
        url: "/api/v1/orders",
        status: 504,
        message: "Failed to fetch: net::ERR_CONNECTION_TIMED_OUT",
      });
    } finally {
      setIsAnalyzingNetwork(false);
    }
  };

  const handleAnalyzeNetworkError = async (overrideParams?: {
    error_type?: string;
    url?: string;
    status?: number;
    message?: string;
  }) => {
    setIsAnalyzingNetwork(true);
    try {
      const payload = {
        error_type: overrideParams?.error_type || networkErrorType,
        url: overrideParams?.url || networkUrl,
        status: overrideParams?.status || networkStatus,
        message: overrideParams?.message || networkLog,
        tenant_id: currentTenant.tenant_id,
        context: {
          client_agent: typeof navigator !== "undefined" ? navigator.userAgent : "Chrome/130.0 Enterprise Observability",
          origin: typeof window !== "undefined" ? window.location.origin : "http://localhost:3000",
        },
      };

      const res = await apiFetch("/api/analyze-network-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        setNetworkAnalysisResult(data);
      }
    } catch (err) {
      console.error("Analyze network error API failure:", err);
    } finally {
      setIsAnalyzingNetwork(false);
    }
  };

  return (
    <div className="space-y-6">
      <StackScanLoader
        isOpen={isAnalyzingNetwork}
        scenarioTitle="Diagnosing Network Anomaly with AI..."
        activeModelLabel="Gemini 3.5 Flash Network Diagnostic"
      />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-white/10 gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Network Anomaly &amp; Dev Console Diagnostic Studio
                </h1>
                <span className="text-[10px] font-mono-code bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
                  MULTI-ORIGIN TELEMETRY
                </span>
              </div>
              <p className="text-xs text-[#9AA4B2] mt-0.5">
                Ingest &amp; diagnose network anomalies across 3 origins: Browser DevTools Console, Microservices, and Synthetic Chaos.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 font-mono-code text-xs">
          <span className="text-[#626E7E]">Target Tenant:</span>
          <span className="text-[#C8F63B] bg-white/5 border border-white/10 px-2.5 py-1 rounded-md">
            {currentTenant.tenant_name}
          </span>
        </div>
      </div>

      {/* Origin Selection & Quick Triggers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#0D1117] border border-blue-500/30 rounded-xl p-4 relative overflow-hidden group hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-blue-400 font-bold text-xs uppercase tracking-wider">
              <Terminal className="w-4 h-4" />
              <span>1. Browser Dev Console</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
          </div>
          <p className="text-[11px] text-[#9AA4B2] leading-relaxed mb-3">
            Captures live <code className="text-white">fetch()</code> and <code className="text-white">XMLHttpRequest</code> failures from client applications.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => handleSimulateBrowserNetworkFault("504")}
              className={`text-[10px] font-mono-code px-2 py-1 rounded border transition-colors ${
                activePresetId === "504"
                  ? "bg-blue-500 text-white border-blue-400 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              Simulate 504 Timeout
            </button>
            <button
              onClick={() => handleSimulateBrowserNetworkFault("502")}
              className={`text-[10px] font-mono-code px-2 py-1 rounded border transition-colors ${
                activePresetId === "502"
                  ? "bg-blue-500 text-white border-blue-400 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              Simulate 502 Bad GW
            </button>
            <button
              onClick={() => handleSimulateBrowserNetworkFault("403")}
              className={`text-[10px] font-mono-code px-2 py-1 rounded border transition-colors ${
                activePresetId === "403"
                  ? "bg-blue-500 text-white border-blue-400 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              Simulate 403 CORS
            </button>
          </div>
        </div>

        <div className="bg-[#0D1117] border border-white/10 rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
              <Bug className="w-4 h-4" />
              <span>2. Application Services</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <p className="text-[11px] text-[#9AA4B2] leading-relaxed mb-3">
            Service mesh sidecar proxy logs, Envoy routing failures, and connection pool saturations.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() =>
                handleLoadPreset({
                  id: "envoy",
                  type: "EnvoyUpstreamReset",
                  url: "http://payment-service:8080/v2/charge",
                  status: 503,
                  message: "upstream connect error or disconnect/reset before headers. reset reason: connection termination",
                  consoleMsg: "[EnvoyServiceMesh] 503 Service Unavailable upstream reset on payment-service:8080",
                })
              }
              className={`text-[10px] font-mono-code px-2 py-1 rounded border transition-colors ${
                activePresetId === "envoy"
                  ? "bg-purple-500 text-white border-purple-400 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              Load Envoy 503 Reset
            </button>
          </div>
        </div>

        <div className="bg-[#0D1117] border border-white/10 rounded-xl p-4 relative overflow-hidden group hover:border-white/20 transition-all">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
              <Radio className="w-4 h-4" />
              <span>3. Synthetic WAN Chaos</span>
            </div>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <p className="text-[11px] text-[#9AA4B2] leading-relaxed mb-3">
            Toxiproxy edge network disruption: packet loss (15%), latency injection (+450ms).
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() =>
                handleLoadPreset({
                  id: "toxiproxy",
                  type: "WANPacketLossLatency",
                  url: "https://wan-gateway.internal:443/sync",
                  status: 504,
                  message: "Toxiproxy injected 450ms jitter + 18.5% packet loss causing socket timeout",
                  consoleMsg: "[ToxiproxyChaos] Synthetic WAN degradation: latency 485ms (baseline 5.4ms), drop rate 18.5%",
                })
              }
              className={`text-[10px] font-mono-code px-2 py-1 rounded border transition-colors ${
                activePresetId === "toxiproxy"
                  ? "bg-amber-500 text-white border-amber-400 font-bold"
                  : "bg-white/5 hover:bg-white/10 text-white border-white/10"
              }`}
            >
              Load WAN Jitter Preset
            </button>
          </div>
        </div>
      </div>

      {/* Main Diagnostic Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Intercepted Console & Error Payload */}
        <div className="lg:col-span-5 space-y-4">
          {/* Live DevTools Stream Box */}
          <div className="bg-black/60 border border-white/10 rounded-xl p-4 font-mono-code text-xs">
            <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/10">
              <div className="flex items-center gap-2 text-[#9AA4B2]">
                <div className="flex gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80 inline-block"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500/80 inline-block"></span>
                </div>
                <span className="text-[11px] font-bold text-white ml-1">Live DevTools Console Stream</span>
              </div>
              <span className="text-[10px] bg-red-500/10 text-red-400 px-2 py-0.5 rounded font-bold">
                {capturedConsoleLogs.length} events
              </span>
            </div>

            <div className="space-y-1.5 max-h-[180px] overflow-y-auto pr-1">
              {capturedConsoleLogs.map((log, i) => (
                <div
                  key={i}
                  className={`p-1.5 rounded text-[11px] leading-relaxed break-all ${
                    log.level === "error"
                      ? "bg-red-500/10 text-red-300 border-l-2 border-red-500"
                      : log.level === "warn"
                      ? "bg-yellow-500/10 text-yellow-300 border-l-2 border-yellow-500"
                      : "bg-white/5 text-[#9AA4B2]"
                  }`}
                >
                  <span className="text-[#626E7E] mr-2">[{log.ts}]</span>
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Network Error Composer */}
          <div className="bg-[#0D1117] border border-white/10 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-[#C8F63B]" />
              Network Anomaly Input Parameters
            </h3>

            <div>
              <label className="text-[10px] font-mono-code text-[#626E7E] block mb-1">TARGET URL / ENDPOINT</label>
              <input
                type="text"
                value={networkUrl}
                onChange={(e) => setNetworkUrl(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B]"
                placeholder="/api/v1/orders"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono-code text-[#626E7E] block mb-1">HTTP STATUS</label>
                <input
                  type="number"
                  value={networkStatus}
                  onChange={(e) => setNetworkStatus(parseInt(e.target.value) || 500)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B]"
                  placeholder="504"
                />
              </div>
              <div>
                <label className="text-[10px] font-mono-code text-[#626E7E] block mb-1">ERROR CLASSIFICATION</label>
                <input
                  type="text"
                  value={networkErrorType}
                  onChange={(e) => setNetworkErrorType(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B]"
                  placeholder="GatewayTimeout"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono-code text-[#626E7E] block mb-1">RAW LOG / ERROR MESSAGE</label>
              <textarea
                value={networkLog}
                onChange={(e) => setNetworkLog(e.target.value)}
                rows={3}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B]"
                placeholder="Paste network error trace or curl output..."
              />
            </div>

            <button
              onClick={() => handleAnalyzeNetworkError()}
              disabled={isAnalyzingNetwork}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#C8F63B] hover:bg-[#d8ff54] text-[#07090C] transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(200,246,59,0.2)] disabled:opacity-50"
            >
              {isAnalyzingNetwork ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Isolating Root Cause with AI...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>Analyze Network Anomaly with AI</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: AI Root Cause Analysis & Code-Level Runbooks */}
        <div className="lg:col-span-7">
          <div className="bg-[#0D1117] border border-white/10 rounded-xl p-5 h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#C8F63B]" />
                  <h3 className="text-sm font-bold text-white">AI Root Cause Isolation &amp; Remediation Fixes</h3>
                </div>
                <span className="text-[10px] font-mono-code text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded font-bold">
                  GROUNDED IN TELEMETRY
                </span>
              </div>

              {networkAnalysisResult ? (
                <div className="space-y-4">
                  {/* Root Cause Banner */}
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-red-400">
                        Root Cause: {networkAnalysisResult.root_cause}
                      </span>
                      <span className="text-[10px] font-mono-code bg-red-500/20 text-red-300 px-2 py-0.5 rounded font-bold">
                        {Math.round((networkAnalysisResult.confidence || 0.94) * 100)}% CONFIDENCE
                      </span>
                    </div>
                    <p className="text-xs text-white leading-relaxed">{networkAnalysisResult.summary}</p>
                    <div className="mt-2 text-[11px] font-mono-code text-[#9AA4B2] flex items-center gap-3">
                      <span>Affected Service: <strong className="text-white">{networkAnalysisResult.affected_service}</strong></span>
                      <span>•</span>
                      <span>Severity: <strong className="text-red-400 uppercase">{networkAnalysisResult.severity}</strong></span>
                    </div>
                  </div>

                  {/* Remediation Steps & Code Fixes */}
                  <div>
                    <h4 className="text-xs font-bold text-[#C8F63B] mb-2 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Recommended Runbook Actions &amp; Fixes
                    </h4>
                    <div className="space-y-3">
                      {(networkAnalysisResult.recommended_fixes || []).map((fix: any, idx: number) => (
                        <div key={idx} className="bg-black/50 border border-white/10 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-bold text-white flex items-center gap-1.5">
                              <span className="w-4 h-4 rounded-full bg-[#C8F63B]/20 text-[#C8F63B] text-[10px] flex items-center justify-center font-bold">
                                {idx + 1}
                              </span>
                              {fix.title}
                            </span>
                            {fix.code && (
                              <button
                                onClick={() => handleCopyFix(fix.code, idx)}
                                className="text-[10px] font-mono-code text-[#9AA4B2] hover:text-white flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded transition-colors"
                              >
                                {copiedFixIndex === idx ? (
                                  <>
                                    <Check className="w-3 h-3 text-[#22C55E]" />
                                    <span className="text-[#22C55E]">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3" />
                                    <span>Copy Snippet</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                          <p className="text-[11px] text-[#9AA4B2] mb-2 leading-relaxed">{fix.description}</p>
                          {fix.code && (
                            <pre className="bg-black/80 border border-white/5 rounded-lg p-2.5 text-[11px] font-mono-code text-[#C8F63B] overflow-x-auto leading-relaxed">
                              {fix.code}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-[#626E7E] flex flex-col items-center justify-center">
                  <Radio className="w-8 h-8 text-[#626E7E] mb-2 animate-pulse" />
                  <p className="text-xs font-semibold text-white">Network Diagnostics Ready</p>
                  <p className="text-[11px] text-[#9AA4B2] max-w-sm mt-1">
                    Click one of the simulation buttons on the left or enter a custom failure to have AI isolate the root cause and generate copyable fix runbooks.
                  </p>
                </div>
              )}
            </div>

            {networkAnalysisResult && (
              <div className="pt-4 border-t border-white/10 flex items-center justify-between text-xs mt-4">
                <span className="text-[#9AA4B2]">Diagnostic grounded via Ingest API detector.</span>
                <Link
                  href="/dashboard"
                  className="font-bold bg-[#C8F63B] hover:bg-[#d8ff54] text-[#07090C] px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
                >
                  <span>Return to Fleet Overview</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
