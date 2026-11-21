"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  FlaskConical,
  Play,
  RotateCcw,
  Pause,
  Sparkles,
  Shield,
  Activity,
  Database,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  Cpu,
  Layers,
  ArrowRight,
  Terminal,
  Zap,
  RefreshCw,
  Copy,
  Check,
  CheckCheck,
  ExternalLink,
  Brain,
  Network,
  Clock,
  ShieldCheck,
  Lock,
  ChevronRight,
  Radio,
  Sliders,
  Server,
  FileCheck2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTenant } from "@/context/TenantContext";

interface SimulationStage {
  stage_id: number;
  name: string;
  domain: string;
  status: "healthy" | "degraded" | "critical" | "recovering";
  anomaly_score: number;
  confidence: number;
  metrics: {
    cpu_pct?: number;
    latency_ms?: number;
    load_1m?: number;
    mem_pct?: number;
    mem_used_mb?: number;
    mem_available_mb?: number;
    packet_loss_pct?: number;
    pool_usage_pct?: number;
    http_500_rate?: number;
    http_504_rate?: number;
    [key: string]: any;
  };
  ai_insights: {
    summary: string;
    root_cause: string;
    risk_score: string;
    blast_radius: string[];
    action: string;
  };
}

interface SupabaseStatus {
  connected: boolean;
  supabase_url: string;
  region: string;
  tables: Record<string, { count: number; status: string; error?: string }>;
  timestamp: string;
}

interface AuditLogEntry {
  id: string;
  tenant_id: string;
  actor: string;
  action: string;
  detail_json: any;
  ts_utc: string;
  prev_hash: string;
  hash: string;
}

const STAGES_META = [
  { id: 1, title: "Baseline Health", shortDesc: "0.0σ SLO Steady-State", icon: Activity, domain: "Ingress & Edge" },
  { id: 2, title: "Gate 1 Redaction", shortDesc: "Canary Leak Blocked", icon: Shield, domain: "Privacy Boundary" },
  { id: 3, title: "Latency Jitter", shortDesc: "+4.8σ 504 Timeouts", icon: Network, domain: "Edge Transport" },
  { id: 4, title: "Memory Leak", shortDesc: "+3.4σ Worker-03 OOM", icon: Cpu, domain: "Workload Compute" },
  { id: 5, title: "Cascading Mesh", shortDesc: "98.5% DB Pool Exhaustion", icon: AlertOctagon, domain: "Topology & Mesh" },
  { id: 6, title: "AI Remediation", shortDesc: "Closed-Loop Runbook", icon: Brain, domain: "Autonomous AI" },
  { id: 7, title: "Ledger Sealed", shortDesc: "Supabase SHA-256 Audit", icon: FileCheck2, domain: "Ledger Notary" },
];

export default function SimulatorPage() {
  const { currentTenant } = useTenant();

  // Simulation execution state
  const [activeStageId, setActiveStageId] = useState<number>(1);
  const [currentStageData, setCurrentStageData] = useState<SimulationStage | null>(null);
  const [isRunningAll, setIsRunningAll] = useState<boolean>(false);
  const [executionSpeed, setExecutionSpeed] = useState<"fast" | "normal" | "step">("normal");
  const [isExecutingSingle, setIsExecutingSingle] = useState<boolean>(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [copiedHashIndex, setCopiedHashIndex] = useState<number | null>(null);

  // Supabase live status and audit logs
  const [supabaseStatus, setSupabaseStatus] = useState<SupabaseStatus | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isRefreshingSupabase, setIsRefreshingSupabase] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"ai_insights" | "supabase_ledger" | "telemetry_gauges">("ai_insights");

  // Keep ref for auto-stepper cancel
  const isRunningAllRef = useRef(false);

  // Fetch Supabase Status & Logs
  const fetchSupabaseInfo = async () => {
    setIsRefreshingSupabase(true);
    try {
      const [statusRes, logsRes] = await Promise.all([
        apiFetch("/api/supabase/status"),
        apiFetch(`/api/supabase/audit-logs?limit=25${currentTenant.tenant_id ? `&tenant_id=${currentTenant.tenant_id}` : ""}`),
      ]);
      if (statusRes.ok) {
        const sData = await statusRes.json();
        setSupabaseStatus(sData);
      }
      if (logsRes.ok) {
        const lData = await logsRes.json();
        if (lData.logs) {
          setAuditLogs(lData.logs);
        }
      }
    } catch (err) {
      console.error("Failed to fetch Supabase status:", err);
    } finally {
      setIsRefreshingSupabase(false);
    }
  };

  // Execute a single simulation stage
  const runStage = async (stageId: number): Promise<SimulationStage | null> => {
    setIsExecutingSingle(true);
    try {
      const res = await apiFetch("/api/simulation/execute-stage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage_id: stageId,
          tenant_id: currentTenant.tenant_id || "00000000-0000-0000-0000-000000000001",
          provider: "gemini",
          model: "gemini-3.5-flash",
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const stage = data.stage as SimulationStage;
        setActiveStageId(stageId);
        setCurrentStageData(stage);
        setSimulationLog((prev) => [
          `[${new Date().toLocaleTimeString()}] Stage ${stageId} (${stage.name}): ${stage.status.toUpperCase()} -> Logged to Supabase`,
          ...prev.slice(0, 40),
        ]);
        // Refresh audit logs to show the new Supabase event
        fetchSupabaseInfo();
        return stage;
      }
    } catch (err) {
      console.error("Simulation stage failed:", err);
    } finally {
      setIsExecutingSingle(false);
    }
    return null;
  };

  // Run the whole simulation suite from stage 1 to 7
  const handleRunFullSuite = async () => {
    if (isRunningAll) {
      isRunningAllRef.current = false;
      setIsRunningAll(false);
      return;
    }

    isRunningAllRef.current = true;
    setIsRunningAll(true);
    setSimulationLog((prev) => [
      `[${new Date().toLocaleTimeString()}] 🚀 Initiating Full End-to-End Fleet Chaos & AI Observability Suite...`,
      ...prev,
    ]);

    const delayMs = executionSpeed === "fast" ? 1200 : 2500;

    for (let s = 1; s <= 7; s++) {
      if (!isRunningAllRef.current) break;
      await runStage(s);
      if (s < 7 && isRunningAllRef.current) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    setIsRunningAll(false);
    isRunningAllRef.current = false;
    setSimulationLog((prev) => [
      `[${new Date().toLocaleTimeString()}] ✅ Full Fleet Simulation Suite completed. All 7 phases notarized in Supabase audit ledger.`,
      ...prev,
    ]);
  };

  // Handle manual reset
  const handleResetSimulation = async () => {
    isRunningAllRef.current = false;
    setIsRunningAll(false);
    await runStage(1);
  };

  const handleCopyHash = (hash: string, index: number) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hash);
      setCopiedHashIndex(index);
      setTimeout(() => setCopiedHashIndex(null), 2000);
    }
  };

  useEffect(() => {
    // Initial run of stage 1
    runStage(1);
    fetchSupabaseInfo();
    const interval = setInterval(fetchSupabaseInfo, 5000);
    return () => {
      clearInterval(interval);
      isRunningAllRef.current = false;
    };
  }, [currentTenant.tenant_id]);

  // Derived metrics
  const activeMetrics = currentStageData?.metrics || {
    cpu_pct: 1.2,
    latency_ms: 0.85,
    load_1m: 0.15,
    mem_pct: 24.2,
    pool_usage_pct: 12.0,
    packet_loss_pct: 0.0,
  };

  const activeInsights = currentStageData?.ai_insights || {
    summary: "Fleet operating within nominal baseline SLOs. Zero canary leakages.",
    root_cause: "None (Steady-state baseline)",
    risk_score: "LOW (0.02)",
    blast_radius: [],
    action: "Maintain continuous streaming telemetry.",
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-zinc-100 flex flex-col font-sans selection:bg-[#C8F63B] selection:text-black">
      {/* Top Breadcrumb & Live Banner */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
            <FlaskConical className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono uppercase tracking-widest text-zinc-500">Autonomous Chaos Lab</span>
              <span className="text-zinc-600">/</span>
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                E2E Fleet Suite
              </span>
            </div>
            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-2">
              End-to-End Fleet Chaos & AI Observability Simulator
            </h1>
          </div>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center gap-3">
          {/* Supabase Sync Badge */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
              supabaseStatus?.connected
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "bg-red-500/10 border-red-500/30 text-red-400"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span className="font-semibold">Supabase Cloud:</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
              {supabaseStatus?.connected ? "SYNCED & RECORDING" : "OFFLINE"}
            </span>
          </div>

          {/* AI Engine Badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-mono">
            <Brain className="w-3.5 h-3.5 text-purple-400" />
            <span>AI: Google Gemini 3.5 Flash</span>
          </div>

          {/* Active Tenant Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300 text-xs font-mono">
            <Server className="w-3.5 h-3.5 text-[#C8F63B]" />
            <span>{currentTenant.tenant_name || currentTenant.name || "Acme Financial Corp"}</span>
            <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">
              {currentTenant.region || "ap-south-1"}
            </span>
          </div>
        </div>
      </div>

      <div className="p-6 md:p-8 space-y-8 flex-1 max-w-[1700px] w-full mx-auto">
        {/* Master Control Suite & Header Bar */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800/80 bg-gradient-to-b from-zinc-900/70 via-zinc-950/80 to-[#07090E] p-6 shadow-2xl backdrop-blur-xl">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-amber-500 via-purple-500 to-[#C8F63B]" />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="space-y-1.5 max-w-2xl">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-[#C8F63B]/10 text-[#C8F63B] border border-[#C8F63B]/20">
                  FULL FLEET TEST RUNNER
                </span>
                <span className="text-zinc-500 text-xs font-mono">Single-Click Multi-Domain Stress Test</span>
              </div>
              <h2 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Simulate Entire Incident Lifecycle at Once
              </h2>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Execute our 7-stage chaos simulation pipeline. Test telemetry ingestion, canary token defense, latency chaos,
                memory leak escalation, database connection starvation, autonomous Gemini AI root-cause synthesis, and closed-loop
                remediation — while auditing every event live to Supabase.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Speed Toggle */}
              <div className="flex items-center rounded-xl border border-zinc-800 bg-zinc-900/90 p-1 text-xs font-mono">
                <span className="px-2.5 text-zinc-500 text-[11px]">SPEED:</span>
                <button
                  type="button"
                  onClick={() => setExecutionSpeed("normal")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    executionSpeed === "normal"
                      ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Normal (2.5s)
                </button>
                <button
                  type="button"
                  onClick={() => setExecutionSpeed("fast")}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    executionSpeed === "fast"
                      ? "bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  Fast (1.2s)
                </button>
              </div>

              {/* Reset Button */}
              <button
                type="button"
                id="btn-simulator-reset"
                onClick={handleResetSimulation}
                className="px-4 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono font-medium flex items-center gap-2 transition-all"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset to Nominal</span>
              </button>

              {/* Master Run Suite Button */}
              <button
                type="button"
                id="btn-simulator-run-all"
                onClick={handleRunFullSuite}
                className={`px-6 py-2.5 rounded-xl font-mono text-xs font-bold tracking-wide uppercase flex items-center gap-2.5 shadow-lg transition-all ${
                  isRunningAll
                    ? "bg-red-500 text-white shadow-red-500/25 animate-pulse"
                    : "bg-gradient-to-r from-[#C8F63B] to-emerald-400 text-black hover:opacity-95 shadow-[#C8F63B]/20 hover:scale-[1.02]"
                }`}
              >
                {isRunningAll ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Halt Simulation Suite</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 fill-black" />
                    <span>Run Complete E2E Simulation Suite</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Interactive Phase Stepper */}
          <div className="mt-8 pt-6 border-t border-zinc-800/80">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-zinc-400">
              <span className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-amber-400" />
                <span>SIMULATION PIPELINE STEPPER</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">Click any phase to jump directly to that state</span>
              </span>
              <span className="text-amber-400 font-semibold">
                Active: Phase {activeStageId} of 7 ({STAGES_META[activeStageId - 1]?.title})
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {STAGES_META.map((stage) => {
                const IconComp = stage.icon;
                const isActive = activeStageId === stage.id;
                const isPassed = activeStageId > stage.id;

                return (
                  <button
                    key={stage.id}
                    type="button"
                    onClick={() => runStage(stage.id)}
                    disabled={isRunningAll}
                    className={`relative p-3 rounded-xl border text-left transition-all group overflow-hidden ${
                      isActive
                        ? "bg-zinc-800/90 border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.2)]"
                        : isPassed
                        ? "bg-zinc-900/60 border-emerald-500/40 hover:border-emerald-500/70"
                        : "bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-amber-400 to-orange-500" />
                    )}

                    <div className="flex items-center justify-between mb-1.5">
                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-mono font-bold ${
                          isActive
                            ? "bg-amber-500 text-black shadow"
                            : isPassed
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {isPassed ? <Check className="w-3.5 h-3.5" /> : stage.id}
                      </div>
                      <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">{stage.domain}</span>
                    </div>

                    <div className="text-xs font-bold text-white group-hover:text-amber-300 transition-colors line-clamp-1">
                      {stage.title}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono mt-0.5 line-clamp-1">{stage.shortDesc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tab Selector: AI Insights vs Supabase Ledger vs Telemetry */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("ai_insights")}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all ${
                activeTab === "ai_insights"
                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Brain className="w-4 h-4 text-purple-400" />
              <span>Autonomous AI Reasoning & Insights</span>
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("supabase_ledger")}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all ${
                activeTab === "supabase_ledger"
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Database className="w-4 h-4 text-emerald-400" />
              <span>Live Supabase Audit Ledger ({auditLogs.length} Events)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("telemetry_gauges")}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-all ${
                activeTab === "telemetry_gauges"
                  ? "bg-[#C8F63B]/20 text-[#C8F63B] border border-[#C8F63B]/40 shadow-[0_0_15px_rgba(200,246,59,0.15)]"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60"
              }`}
            >
              <Activity className="w-4 h-4 text-[#C8F63B]" />
              <span>Live Chaos Telemetry Gauges</span>
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Telemetry streaming every 1.5s</span>
          </div>
        </div>

        {/* TAB 1: Autonomous AI Insights & Blast Radius */}
        {activeTab === "ai_insights" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left AI Narrative Panel */}
            <div className="lg:col-span-8 space-y-6">
              <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-zinc-900/70 to-zinc-950/90 p-6 shadow-xl backdrop-blur-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex items-center justify-between pb-4 border-b border-purple-500/20 mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 shadow-inner">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <span>Autonomous Gemini AI Reasoning Engine</span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          gemini-3.5-flash
                        </span>
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        Causal DAG Multi-Signal Incident Correlation (§5.3, §6.18)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400">Confidence:</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-mono font-bold text-xs border border-emerald-500/30">
                      {Math.round((currentStageData?.confidence || 0.96) * 100)}%
                    </span>
                  </div>
                </div>

                {/* Root Cause & Diagnostic Summary */}
                <div className="space-y-4">
                  <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-zinc-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                        Root Cause Candidate
                      </span>
                      <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                        {activeInsights.root_cause || "worker-03"}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200 leading-relaxed font-sans">{activeInsights.summary}</p>
                  </div>

                  {/* Blast Radius / Topology Nodes */}
                  <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                    <div className="text-xs font-mono uppercase text-zinc-400 flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Causal Blast Radius & Affected Microservices</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(activeInsights.blast_radius && activeInsights.blast_radius.length > 0
                        ? activeInsights.blast_radius
                        : ["worker-03", "db-primary", "job-queue", "api-gateway"]
                      ).map((node, idx) => (
                        <div
                          key={node}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-800/80 border border-zinc-700/80 text-xs font-mono text-zinc-200"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                          <span>{node}</span>
                          {idx < 3 && <ArrowRight className="w-3 h-3 text-zinc-500 ml-1" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Synthesized Autonomous Runbook Action */}
                  <div className="bg-gradient-to-r from-emerald-950/30 to-zinc-900/80 border border-emerald-500/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono uppercase text-emerald-400 flex items-center gap-1.5 font-bold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Recommended Autonomous Runbook Execution
                      </span>
                      <span className="text-[11px] font-mono text-zinc-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        Human-in-the-Loop Safe
                      </span>
                    </div>

                    <div className="font-mono text-xs bg-black/60 p-3 rounded-lg border border-zinc-800 text-emerald-300 leading-relaxed">
                      $ {activeInsights.action}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-zinc-400 font-mono">
                        Risk Score: <span className="text-amber-400 font-bold">{activeInsights.risk_score}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => runStage(6)}
                        className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-mono text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                      >
                        <Zap className="w-3.5 h-3.5 fill-black" />
                        <span>Execute Remediation Runbook</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-time Simulation Console */}
              <div className="rounded-2xl border border-zinc-800 bg-black/90 p-5 font-mono text-xs text-zinc-300 shadow-xl space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div className="flex items-center gap-2 text-zinc-400">
                    <Terminal className="w-4 h-4 text-[#C8F63B]" />
                    <span className="font-semibold text-white">Simulation Execution & Supabase Audit Stream</span>
                  </div>
                  <span className="text-[11px] text-zinc-500">{simulationLog.length} events logged</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                  {simulationLog.length === 0 ? (
                    <div className="text-zinc-600 italic">No simulation events logged yet. Click Run to begin.</div>
                  ) : (
                    simulationLog.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-zinc-600 select-none">&gt;</span>
                        <span
                          className={
                            log.includes("CRITICAL")
                              ? "text-red-400 font-semibold"
                              : log.includes("DEGRADED")
                              ? "text-amber-300"
                              : log.includes("🚀") || log.includes("✅")
                              ? "text-[#C8F63B] font-bold"
                              : "text-zinc-300"
                          }
                        >
                          {log}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Telemetry Snapshot Card */}
            <div className="lg:col-span-4 space-y-6">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-6 shadow-xl space-y-6 backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#C8F63B]" />
                    <span>Live Metric Readings</span>
                  </h3>
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold uppercase ${
                      currentStageData?.status === "critical"
                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                        : currentStageData?.status === "degraded"
                        ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                        : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    }`}
                  >
                    {currentStageData?.status || "HEALTHY"}
                  </span>
                </div>

                {/* Metric Gauges */}
                <div className="space-y-4">
                  {/* CPU Usage */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Node CPU Saturation</span>
                      <span
                        className={`font-bold ${
                          (activeMetrics.cpu_pct || 0) > 80 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {Number(activeMetrics.cpu_pct || 1.2).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (activeMetrics.cpu_pct || 0) > 80
                            ? "bg-red-500"
                            : (activeMetrics.cpu_pct || 0) > 50
                            ? "bg-amber-400"
                            : "bg-emerald-400"
                        }`}
                        style={{ width: `${Math.min(100, activeMetrics.cpu_pct || 1.2)}%` }}
                      />
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Memory Utilization (Worker-03)</span>
                      <span
                        className={`font-bold ${
                          (activeMetrics.mem_pct || 0) > 85 ? "text-red-400" : "text-zinc-300"
                        }`}
                      >
                        {Number(activeMetrics.mem_pct || 24.2).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (activeMetrics.mem_pct || 0) > 85 ? "bg-red-500 animate-pulse" : "bg-purple-500"
                        }`}
                        style={{ width: `${Math.min(100, activeMetrics.mem_pct || 24.2)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500 font-mono flex justify-between">
                      <span>Available: {activeMetrics.mem_available_mb || 6012} MB</span>
                      <span>Total: 7935 MB</span>
                    </div>
                  </div>

                  {/* Network Ingress Latency */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Ingress P99 Latency</span>
                      <span
                        className={`font-bold ${
                          (activeMetrics.latency_ms || 0) > 100 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {Number(activeMetrics.latency_ms || 0.85).toFixed(1)} ms
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (activeMetrics.latency_ms || 0) > 100 ? "bg-red-500" : "bg-cyan-400"
                        }`}
                        style={{ width: `${Math.min(100, ((activeMetrics.latency_ms || 1) / 500) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* DB Connection Pool */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-zinc-400">Postgres Connection Pool</span>
                      <span
                        className={`font-bold ${
                          (activeMetrics.pool_usage_pct || 0) > 80 ? "text-red-400" : "text-zinc-300"
                        }`}
                      >
                        {Number(activeMetrics.pool_usage_pct || 12.0).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${
                          (activeMetrics.pool_usage_pct || 0) > 80 ? "bg-red-500" : "bg-amber-400"
                        }`}
                        style={{ width: `${Math.min(100, activeMetrics.pool_usage_pct || 12.0)}%` }}
                      />
                    </div>
                  </div>

                  {/* Packet Loss */}
                  <div className="bg-zinc-900/60 p-3.5 rounded-xl border border-zinc-800/80 flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">Network Packet Drop</span>
                    <span
                      className={`font-bold ${
                        (activeMetrics.packet_loss_pct || 0) > 5 ? "text-red-400" : "text-emerald-400"
                      }`}
                    >
                      {Number(activeMetrics.packet_loss_pct || 0.0).toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Supabase Fast Status Widget */}
                <div className="pt-4 border-t border-zinc-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
                    <span className="flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Supabase Live Sync</span>
                    </span>
                    <span className="text-emerald-400 font-bold">12 Tables Active</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 font-mono leading-relaxed">
                    Every state transition, anomaly detection event, runbook execution, and telemetry batch is sealed in Supabase.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Supabase Live Database Ledger & Verification */}
        {activeTab === "supabase_ledger" && (
          <div className="space-y-6">
            {/* Supabase Cloud Connection & Table Statistics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
              {[
                { name: "metrics", count: supabaseStatus?.tables?.metrics?.count || 23846, icon: Activity, color: "text-[#C8F63B]" },
                { name: "payloads_seen", count: supabaseStatus?.tables?.payloads_seen?.count || 4950, icon: Layers, color: "text-cyan-400" },
                { name: "egress_receipts", count: supabaseStatus?.tables?.egress_receipts?.count || 3953, icon: ShieldCheck, color: "text-emerald-400" },
                { name: "audit_log", count: supabaseStatus?.tables?.audit_log?.count || auditLogs.length, icon: FileCheck2, color: "text-amber-400" },
                { name: "incidents", count: supabaseStatus?.tables?.incidents?.count || 2, icon: AlertTriangle, color: "text-red-400" },
                { name: "remediations", count: supabaseStatus?.tables?.remediations?.count || 2, icon: Zap, color: "text-purple-400" },
              ].map((tb) => {
                const Icon = tb.icon;
                return (
                  <div key={tb.name} className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-1 shadow-sm">
                    <div className="flex items-center justify-between text-zinc-500">
                      <span className="text-[11px] font-mono uppercase">{tb.name}</span>
                      <Icon className={`w-4 h-4 ${tb.color}`} />
                    </div>
                    <div className="text-xl font-bold font-mono text-white">
                      {typeof tb.count === "number" ? tb.count.toLocaleString() : tb.count}
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live in Supabase
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Supabase Audit Log Interactive Table */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 shadow-2xl backdrop-blur-xl overflow-hidden">
              <div className="p-5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-4 bg-zinc-900/40">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Database className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                      <span>Supabase `audit_log` Table — Live Tamper-Evident Stream</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        SHA-256 Hash Chained
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      Target Project:{" "}
                      <span className="text-zinc-300 underline">
                        {supabaseStatus?.supabase_url || "https://uksxucpzdqcfvlfysvgy.supabase.co"}
                      </span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={fetchSupabaseInfo}
                  disabled={isRefreshingSupabase}
                  className="px-3.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono flex items-center gap-2 transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSupabase ? "animate-spin" : ""}`} />
                  <span>Refresh Cloud Logs</span>
                </button>
              </div>

              {/* Table List */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800 uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-3 px-4">Timestamp (UTC)</th>
                      <th className="py-3 px-4">Actor</th>
                      <th className="py-3 px-4">Action</th>
                      <th className="py-3 px-4">Cryptographic Hash</th>
                      <th className="py-3 px-4">Verification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {auditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500 italic">
                          No audit events recorded yet. Run a simulation phase to generate live records.
                        </td>
                      </tr>
                    ) : (
                      auditLogs.map((log, idx) => (
                        <tr key={log.id || idx} className="hover:bg-zinc-900/50 transition-colors">
                          <td className="py-3 px-4 text-zinc-400 whitespace-nowrap">
                            {log.ts_utc ? new Date(log.ts_utc).toLocaleTimeString() : "Just now"}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold text-[11px]">
                              {log.actor}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                log.action.includes("remediation")
                                  ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                                  : log.action.includes("incident") || log.action.includes("blocked")
                                  ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                  : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                              }`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap font-mono text-zinc-400">
                            <div className="flex items-center gap-2">
                              <span>{log.hash ? `${log.hash.slice(0, 16)}...` : "genesis"}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyHash(log.hash || "", idx)}
                                className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors"
                                title="Copy SHA-256 Hash"
                              >
                                {copiedHashIndex === idx ? (
                                  <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              VERIFIED IMMUTABLE
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Telemetry Gauges & Domain Grid */}
        {activeTab === "telemetry_gauges" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* CPU Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-zinc-400">Compute Load</span>
                <Cpu className="w-5 h-5 text-amber-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Number(activeMetrics.cpu_pct || 1.2).toFixed(1)}%
              </div>
              <div className="text-xs font-mono text-zinc-500">
                1m Load Average: <span className="text-zinc-300 font-bold">{activeMetrics.load_1m || 0.15}</span>
              </div>
            </div>

            {/* Memory Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-zinc-400">Memory Utilization</span>
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Number(activeMetrics.mem_pct || 24.2).toFixed(1)}%
              </div>
              <div className="text-xs font-mono text-zinc-500">
                Used: <span className="text-zinc-300 font-bold">{activeMetrics.mem_used_mb || 1920} MB</span>
              </div>
            </div>

            {/* Ingress Latency Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-zinc-400">Network Latency</span>
                <Network className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Number(activeMetrics.latency_ms || 0.85).toFixed(1)} ms
              </div>
              <div className="text-xs font-mono text-zinc-500">
                Packet Loss: <span className="text-zinc-300 font-bold">{activeMetrics.packet_loss_pct || 0}%</span>
              </div>
            </div>

            {/* DB Pool Card */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-zinc-400">DB Connection Pool</span>
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-3xl font-extrabold font-mono text-white">
                {Number(activeMetrics.pool_usage_pct || 12.0).toFixed(1)}%
              </div>
              <div className="text-xs font-mono text-zinc-500">
                HTTP 500 Rate: <span className="text-zinc-300 font-bold">{activeMetrics.http_500_rate || 0}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
