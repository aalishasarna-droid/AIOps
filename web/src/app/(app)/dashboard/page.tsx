"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import StackScanLoader from "@/components/StackScanLoader";
import {
  Shield, Activity, Server, Cpu, HardDrive, Wifi, AlertTriangle,
  CheckCircle2, ArrowRight, RotateCcw, Lock, ExternalLink, Terminal, Zap, RefreshCw, Loader2, Building2, Globe,
  Sparkles, Brain, Check, Radio, Bug, Layers, ChevronRight, Database, UserX
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTenant } from "@/context/TenantContext";
import { useAudioAlerts } from "@/context/AudioAlertContext";

interface TelemetryMetrics {
  cpu_pct?: number;
  cpu_cores?: number;
  load_1m?: number;
  mem_pct?: number;
  mem_used_mb?: number;
  mem_total_mb?: number;
  mem_available_mb?: number;
  disk_pct?: number;
  disk_used_gb?: number;
  disk_total_gb?: number;
  net_rx_kbps?: number;
  net_tx_kbps?: number;
  net_bw_mbps?: number;
  latency_ms?: number;
  packet_loss_pct?: number;
}

interface Incident {
  incident_id: string;
  severity?: string;
  state?: string;
  anomaly_score?: number;
  confidence: number;
  root_cause_candidate: string;
  affected_services?: string[];
}

export default function DashboardPage() {
  const { currentTenant, fleetState, setFleetState, setSecondsAgo } = useTenant();
  const { playAnomalyAlert } = useAudioAlerts();
  const prevIncidentIdRef = useRef<string | null>(null);

  const [fleetReason, setFleetReason] = useState<string>("All systems nominal");
  const [metrics, setMetrics] = useState<TelemetryMetrics>({
    cpu_pct: 1.3,
    cpu_cores: 15,
    load_1m: 0.13,
    mem_pct: 13.8,
    mem_used_mb: 878,
    mem_total_mb: 7935,
    mem_available_mb: 6840,
    disk_pct: 1.4,
    disk_used_gb: 11.8,
    disk_total_gb: 910.7,
    net_rx_kbps: 4.8,
    net_tx_kbps: 8.6,
    latency_ms: 0.86,
    packet_loss_pct: 0.0,
  });

  const [activeIncident, setActiveIncident] = useState<Incident | null>(null);
  const [narration, setNarration] = useState<any>(null);
  const [scenario, setScenario] = useState<string>("normal");
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeScenarioTitle, setActiveScenarioTitle] = useState<string>("Infrastructure Anomaly Scan");
  const [remediationApproved, setRemediationApproved] = useState<boolean>(false);

  // Model switching state
  const [selectedModel, setSelectedModel] = useState<string>("gemini-3.5-flash");
  const [selectedProvider, setSelectedProvider] = useState<string>("gemini");
  const [availableModels, setAvailableModels] = useState<Array<{ id: string; name: string; provider: string }>>([
    { id: "gemini-3.5-flash", name: "Gemini 3.5 Flash", provider: "gemini" },
    { id: "deepseek-r1:14b", name: "Ollama DeepSeek-R1 (14B)", provider: "ollama" },
    { id: "gemma4:12b", name: "Ollama Gemma4 (12B)", provider: "ollama" },
  ]);

  // History for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([1, 1.2, 1.1, 1.4, 1.3, 0.9, 1.3]);
  const [memHistory, setMemHistory] = useState<number[]>([13, 13.2, 13.5, 13.8, 13.8, 13.8, 13.8]);
  const [netHistory, setNetHistory] = useState<number[]>([0.8, 0.9, 0.85, 0.86, 0.88, 0.86, 0.86]);

  // Load models on mount
  useEffect(() => {
    apiFetch("/api/llm/models")
      .then((r) => r.json())
      .then((data) => {
        if (data.models && data.models.length > 0) {
          setAvailableModels(data.models);
          if (data.active_model) setSelectedModel(data.active_model);
          if (data.active_provider) setSelectedProvider(data.active_provider);
        }
      })
      .catch(() => {});
  }, []);

  const fetchLiveTelemetry = async () => {
    try {
      const tenantQuery = currentTenant.tenant_id ? `?tenant_id=${currentTenant.tenant_id}` : "";
      const res = await apiFetch(`/api/telemetry/live${tenantQuery}`);
      if (res.ok) {
        const data = await res.json();
        if (data.fleet_state) setFleetState(data.fleet_state);
        if (data.fleet_reasons && data.fleet_reasons.length > 0) {
          setFleetReason(data.fleet_reasons[0]);
        }
        if (data.scenario) {
          setScenario(data.scenario);
        }
        if (data.latest_metrics) {
          setMetrics(data.latest_metrics);
          if (data.latest_metrics.cpu_pct !== undefined) {
            setCpuHistory((prev) => [...prev.slice(-20), data.latest_metrics.cpu_pct]);
          }
          if (data.latest_metrics.mem_pct !== undefined) {
            setMemHistory((prev) => [...prev.slice(-20), data.latest_metrics.mem_pct]);
          }
          if (data.latest_metrics.latency_ms !== undefined) {
            setNetHistory((prev) => [...prev.slice(-20), data.latest_metrics.latency_ms]);
          }
        }
        if (data.active_incident !== undefined) {
          if (data.active_incident !== null || data.scenario === "normal") {
            setActiveIncident(data.active_incident);
            if (
              data.active_incident &&
              data.active_incident.state === "open" &&
              data.active_incident.incident_id !== prevIncidentIdRef.current
            ) {
              prevIncidentIdRef.current = data.active_incident.incident_id;
              playAnomalyAlert();
            }
          }
        }
        if (data.narration !== undefined) {
          if (data.narration !== null || data.scenario === "normal") {
            setNarration(data.narration);
          }
        }
        if (data.seconds_since_last_payload !== undefined) {
          setSecondsAgo(data.seconds_since_last_payload);
        }
      }
    } catch {
      // transient network recovery
    }
  };

  const handleSetScenario = async (rawSc: string) => {
    let sc = rawSc;
    if (sc === "leak") sc = "memory_leak";
    if (sc === "partition") sc = "db_outage_cascade";

    setScenario(sc);

    if (sc === "normal") {
      setIsAnalyzing(false);
      setFleetState("healthy");
      setFleetReason("All systems nominal");
      setMetrics((m) => ({ ...m, latency_ms: 0.86, cpu_pct: 1.3, mem_pct: 16.3, load_1m: 0.13, packet_loss_pct: 0.0 }));
      setCpuHistory([0.9, 1.2, 1.1, 1.4, 1.3, 0.6, 1.3]);
      setMemHistory([16.1, 16.4, 16.3, 16.5, 16.3]);
      setNetHistory([0.7, 0.85, 0.76, 0.82, 0.71]);
      setActiveIncident(null);
      setNarration(null);

      try {
        await apiFetch("/api/set-scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: "normal", tenant_id: currentTenant.tenant_id }),
        });
      } catch {}
      return;
    }

    const scenarioTitles: Record<string, string> = {
      memory_leak: "Memory Leak Cascade (Worker-03 Pod OOM)",
      leak: "Memory Leak Cascade (Worker-03 Pod OOM)",
      db_memory_crash: "DB Memory Crash & Connection Pool Exhaustion (Primary DB)",
      db_crash: "DB Memory Crash & Connection Pool Exhaustion (Primary DB)",
      brute_force_login: "Brute-Force Credential Stuffing & Rate-Limit Anomaly (429 Flood)",
      brute_force: "Brute-Force Credential Stuffing & Rate-Limit Anomaly (429 Flood)",
      db_outage_cascade: "Cascading Network Partition (Ingress to Payment API)",
      partition: "Cascading Network Partition (Ingress to Payment API)",
      cpu_spike: "CPU Saturation & Thread Pool Exhaustion (Auth Node)",
      net_latency: "Network Latency & Packet Loss Anomaly (Ingress Gateway)",
    };
    setActiveScenarioTitle(scenarioTitles[sc] || "Infrastructure Anomaly Scan");
    setIsAnalyzing(true);
    setRemediationApproved(false);

    // Trigger enterprise audio alert chime (respects audioEnabled setting)
    playAnomalyAlert();

    if (sc === "memory_leak" || sc === "leak") {
      setFleetState("critical");
      setFleetReason("High Memory Growth Rate in worker-03 (+3.4σ EWMA, Pod OOM hazard)");
      setMetrics((m) => ({ ...m, mem_pct: 94.8, mem_used_mb: 7522, mem_available_mb: 413 }));
      setMemHistory([16.5, 28.2, 45.1, 62.8, 78.4, 94.8]);
      setActiveIncident({
        incident_id: "inc-mem-003",
        severity: "critical",
        state: "open",
        anomaly_score: 0.94,
        confidence: 0.97,
        root_cause_candidate: "worker-03",
        affected_services: ["worker-03", "job-queue", "api-gateway"],
      });
      setNarration({
        narration: "Critical memory growth detected on worker-03 exceeding threshold (+3.4σ EWMA). Unbounded buffer accumulation in event streaming thread pool.",
        root_cause: { entity: "worker-03", confidence: 0.94 },
        steps: [
          "Isolate and terminate worker-03 pod to prevent node-level kernel OOM panic: kubectl delete pod worker-03 --now",
          "Trigger automated container restart with pinned JVM/Node max-old-space-size limits",
          "Capture heap snapshot dump from storage volume for memory leak path analysis",
        ],
      });
    } else if (sc === "db_memory_crash" || sc === "db_crash") {
      setFleetState("critical");
      setFleetReason("PostgreSQL Primary Memory Exhaustion & Buffer Pool Collapse (+4.9σ EWMA)");
      setMetrics((m) => ({ ...m, mem_pct: 98.4, mem_used_mb: 7850, latency_ms: 1240.5 }));
      setMemHistory([18.0, 38.5, 64.0, 85.2, 94.1, 98.4]);
      setActiveIncident({
        incident_id: "inc-db-crash-007",
        severity: "critical",
        state: "open",
        anomaly_score: 0.99,
        confidence: 0.98,
        root_cause_candidate: "db-primary",
        affected_services: ["db-primary", "payment-api", "billing-service"],
      });
      setNarration({
        narration: "Catastrophic database memory crash and pool starvation on db-primary (+4.9σ EWMA). Exhausted shared_buffers and heavy unindexed sequential table scans.",
        root_cause: { entity: "db-primary", confidence: 0.98 },
        steps: [
          "Terminate unindexed sequential scan connections: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state != 'idle';`",
          "Promote warm read-replica `db-replica-02` to redirect read queries immediately",
          "Apply PgBouncer reserve pool allocation to restore customer transactions",
        ],
      });
    } else if (sc === "brute_force_login" || sc === "brute_force") {
      setFleetState("critical");
      setFleetReason("Distributed Brute-Force Credential Attack & Auth Ingress Saturation (429 Flood)");
      setMetrics((m) => ({ ...m, cpu_pct: 94.5, latency_ms: 320.0, packet_loss_pct: 5.2 }));
      setCpuHistory([14.0, 38.2, 72.1, 89.0, 94.5]);
      setActiveIncident({
        incident_id: "inc-auth-brute-008",
        severity: "critical",
        state: "open",
        anomaly_score: 0.97,
        confidence: 0.96,
        root_cause_candidate: "auth-gateway",
        affected_services: ["auth-gateway", "session-store", "customer-portal"],
      });
      setNarration({
        narration: "Distributed brute-force credential stuffing attack detected targeting /api/v1/auth/login. Over 4,200 failed auth attempts/sec bypassing basic rate limits.",
        root_cause: { entity: "auth-gateway", confidence: 0.96 },
        steps: [
          "Enforce Cloudflare/Envoy IP reputation threshold and turn on automated CAPTCHA challenge",
          "Temporarily lower account lockout threshold to 5 consecutive failed attempts per 15-minute window",
          "Trigger automated IP-range ban for offending ASN botnets via eBPF XDP filter",
        ],
      });
    } else if (sc === "cpu_spike") {
      setFleetState("critical");
      setFleetReason("CPU Saturation & Thread Pool Starvation on Auth Node (+4.8σ EWMA)");
      setMetrics((m) => ({ ...m, cpu_pct: 96.4, load_1m: 12.8, latency_ms: 145.2 }));
      setCpuHistory([12.0, 35.4, 62.1, 84.5, 92.0, 96.4]);
      setActiveIncident({
        incident_id: "inc-cpu-005",
        severity: "critical",
        state: "open",
        anomaly_score: 0.95,
        confidence: 0.96,
        root_cause_candidate: "auth-node-01",
        affected_services: ["auth-service", "api-gateway", "session-store"],
      });
      setNarration({
        narration: "Severe CPU saturation and thread pool starvation detected on auth-node-01 (+4.8σ EWMA). Cryptographic hash verification backlog saturating all available cores.",
        root_cause: { entity: "auth-node-01", confidence: 0.96 },
        steps: [
          "Scale out auth worker replica count: kubectl scale deployment auth-service --replicas=8",
          "Profile hot thread execution loops with `perf top -p $(pgrep auth-worker)`",
          "Temporarily throttle non-essential background token refresh cron jobs",
        ],
      });
    } else if (sc === "net_latency") {
      setFleetState("critical");
      setFleetReason("Network Gateway Congestion & High Packet Loss (485ms latency, 18.5% drop)");
      setMetrics((m) => ({ ...m, latency_ms: 485.2, packet_loss_pct: 18.5 }));
      setNetHistory([0.8, 2.4, 45.0, 180.2, 340.5, 485.2]);
      setActiveIncident({
        incident_id: "inc-net-004",
        severity: "critical",
        state: "open",
        anomaly_score: 0.96,
        confidence: 0.98,
        root_cause_candidate: "ingress-gateway",
        affected_services: ["ingress-gateway", "orders-api", "payment-service"],
      });
      setNarration({
        narration: "Massive ingress packet loss (18.5%) and gateway latency spike (485ms) causing upstream timeouts on ingress-gateway.",
        root_cause: { entity: "ingress-gateway", confidence: 0.98 },
        steps: [
          "Increase proxy upstream timeout in ingress configuration: proxy_read_timeout 60s; proxy_connect_timeout 10s;",
          "Check for saturated NIC queues or packet drops with `ip -s link show` and adjust ring buffer size `ethtool -G eth0 rx 4096`",
          "Apply circuit-breaker policy to route non-critical traffic to healthy degraded backup cluster",
        ],
      });
    } else {
      setFleetState("critical");
      setFleetReason("Cascading Timeouts Detected (Payment Gateway & Postgres Connection Pool)");
      setMetrics((m) => ({ ...m, latency_ms: 845.0, packet_loss_pct: 8.5, cpu_pct: 89.5 }));
      setNetHistory([1.2, 5.4, 120.0, 450.0, 720.0, 845.0]);
      setActiveIncident({
        incident_id: "inc-db-001",
        severity: "critical",
        state: "open",
        anomaly_score: 0.88,
        confidence: 0.93,
        root_cause_candidate: "db-primary",
        affected_services: ["db-primary", "payment-api", "frontend-edge"],
      });
      setNarration({
        narration: "PostgreSQL primary connection pool saturation (98.5% capacity) cascading into database timeouts across downstream payment APIs.",
        root_cause: { entity: "db-primary", confidence: 0.88 },
        steps: [
          "Terminate idle-in-transaction connections with `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';`",
          "Increase PgBouncer max client connections pool limit by +50 slots",
          "Enable read-replica fallback routing for all read-only customer dashboard queries",
        ],
      });
    }

    try {
      let res = await apiFetch("/api/set-scenario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: sc, tenant_id: currentTenant.tenant_id }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await apiFetch("/api/telemetry/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario: sc, tenant_id: currentTenant.tenant_id }),
        }).catch(() => null);
      }

      if (res && res.ok) {
        const data = await res.json();
        if (data.active_incident) setActiveIncident(data.active_incident);
        if (data.narration) setNarration(data.narration);
      }
    } catch {}

    setTimeout(() => {
      setIsAnalyzing(false);
    }, 2800);
  };

  const handleModelChange = async (modelId: string) => {
    setSelectedModel(modelId);
    const m = availableModels.find((mod) => mod.id === modelId);
    if (m) setSelectedProvider(m.provider);

    try {
      await apiFetch("/api/llm/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelId, provider: m ? m.provider : "gemini" }),
      });
    } catch (e) {
      console.error("Failed to set LLM config:", e);
    }
  };

  const handleApproveRemediation = async () => {
    setRemediationApproved(true);
    try {
      await apiFetch("/api/remediation/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: currentTenant.tenant_id || "00000000-0000-0000-0000-000000000001",
          incident_id: activeIncident?.incident_id || "inc-db-001",
          action: "approve_autonomous_runbook",
          actor: "security_admin",
        }),
      });
    } catch (e) {
      console.error("Failed to approve remediation:", e);
    }
    setTimeout(() => {
      handleSetScenario("normal");
      setRemediationApproved(false);
    }, 1500);
  };

  useEffect(() => {
    fetchLiveTelemetry();
    const interval = setInterval(fetchLiveTelemetry, 1500);
    return () => clearInterval(interval);
  }, [currentTenant.tenant_id]);

  // SVG sparkline path builder
  const buildSvgPath = (data: number[], height: number, width: number) => {
    if (!data.length) return "";
    const min = Math.min(...data, 0);
    const max = Math.max(...data, 100);
    const range = max - min || 1;
    const pts = data.map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 8) - 4;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return `M ${pts.join(" L ")}`;
  };

  const displayWhyFlagged =
    narration?.narration ||
    narration?.evidence?.why_flagged ||
    narration?.why_flagged ||
    (fleetState === "critical"
      ? "Critical anomaly cascade detected across infrastructure dependencies."
      : fleetState === "degraded"
      ? "Elevated statistical variance detected in telemetry streams."
      : "Baseline telemetry operating within acceptable statistical boundaries (EWMA deviation < 1.0σ).");

  const displayRootCause =
    narration?.evidence?.root_cause ||
    narration?.root_cause ||
    (activeIncident ? { entity: activeIncident.root_cause_candidate, confidence: activeIncident.confidence } : null);

  const displayReasoningPath =
    narration?.evidence?.reasoning_path ||
    narration?.reasoning_path ||
    (activeIncident
      ? [
          `1. Telemetry spike detected on foundational dependency '${activeIncident.root_cause_candidate}'`,
          `2. Cascading timeouts propagating to: ${(activeIncident.affected_services || []).join(", ") || "dependent nodes"}`,
          `3. End-user latency and error rates elevated beyond SLA thresholds`,
        ]
      : null);

  const displaySteps =
    narration?.steps ||
    narration?.evidence?.recommended_steps ||
    narration?.recommended_steps ||
    (activeIncident
      ? [
          `Inspect connection pool and resource utilization on ${activeIncident.root_cause_candidate}.`,
          `Execute autonomous remediation runbook to restore capacity.`,
          `Verify latency recovery across downstream dependents.`,
        ]
      : null);

  return (
    <div className="space-y-6">
      {/* 3D Stack Scan Loader */}
      <StackScanLoader
        isOpen={isAnalyzing}
        scenarioTitle={activeScenarioTitle}
        activeModelLabel={
          selectedModel.includes("deepseek")
            ? "Ollama DeepSeek-R1 (14B) Local Reasoning"
            : selectedModel.includes("gemma")
            ? "Ollama Gemma4 (12B) Local Reasoning"
            : "Gemini 3.5 Flash Active Reasoning"
        }
      />

      {/* Top Scenario Triggers & AI Engine Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-[#0D1117] border border-white/10 rounded-2xl p-4 gap-4 shadow-lg">
        {/* Synthetic Scenario Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-mono-code text-[#626E7E] uppercase tracking-wider mr-1">
            Simulate Incident:
          </span>
          <button
            id="btn-scenario-normal"
            onClick={() => handleSetScenario("normal")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "normal"
                ? "bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/60 font-bold shadow-[0_0_12px_rgba(34,197,94,0.3)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
          >
            🟢 All Nominal
          </button>
          <button
            id="btn-scenario-leak"
            onClick={() => handleSetScenario("memory_leak")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "leak" || scenario === "memory_leak"
                ? "bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/60 font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
          >
            🔴 Memory Leak
          </button>
          <button
            id="btn-scenario-partition"
            onClick={() => handleSetScenario("db_outage_cascade")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "partition" || scenario === "db_outage_cascade"
                ? "bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/60 font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
          >
            🔴 Cascading Partition
          </button>
          <button
            id="btn-scenario-cpu"
            onClick={() => handleSetScenario("cpu_spike")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "cpu_spike" || scenario === "cpu" || scenario === "cpu_saturation"
                ? "bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/60 font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
          >
            🔴 CPU Saturation
          </button>
          <button
            id="btn-scenario-network"
            onClick={() => handleSetScenario("net_latency")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "net_latency" || scenario === "network_error" || scenario === "network_latency"
                ? "bg-blue-500/25 text-blue-400 border border-blue-500/60 font-bold shadow-[0_0_12px_rgba(59,130,246,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
          >
            🌐 Network Latency
          </button>
          <button
            id="btn-scenario-db-crash"
            onClick={() => handleSetScenario("db_memory_crash")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "db_memory_crash" || scenario === "db_crash"
                ? "bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/60 font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
            title="Simulate DB Memory Crash and connection pool exhaustion"
          >
            🔴 DB Memory Crash
          </button>
          <button
            id="btn-scenario-brute-force"
            onClick={() => handleSetScenario("brute_force_login")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer select-none active:scale-95 transition-all duration-200 ${
              scenario === "brute_force_login" || scenario === "brute_force"
                ? "bg-[#EF4444]/25 text-[#EF4444] border border-[#EF4444]/60 font-bold shadow-[0_0_12px_rgba(239,68,68,0.35)]"
                : "bg-white/5 hover:bg-white/10 text-white border border-white/10"
            }`}
            title="Simulate Brute-Force Login & Rate-Limit Anomaly"
          >
            🔴 Brute-Force Login
          </button>
        </div>

        {/* AI Reasoning Engine Selector */}
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-[#C8F63B]" />
          <span className="text-[11px] font-mono-code text-[#626E7E] hidden sm:inline">AI Engine:</span>
          <select
            value={selectedModel}
            onChange={(e) => handleModelChange(e.target.value)}
            className="bg-black/60 border border-white/10 text-white text-xs font-mono-code rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-[#C8F63B] cursor-pointer"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id} className="bg-[#0D1117] text-white">
                {m.name} {m.provider === "ollama" ? "(Local On-Prem)" : "(Cloud SaaS)"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Executive Fleet Health & Incident Status Banner */}
      <section
        className={`p-6 rounded-2xl border transition-all duration-300 shadow-xl ${
          fleetState === "critical"
            ? "bg-gradient-to-r from-red-950/40 via-[#0D1117] to-[#0D1117] border-red-500/40"
            : fleetState === "degraded"
            ? "bg-gradient-to-r from-amber-950/40 via-[#0D1117] to-[#0D1117] border-amber-500/40"
            : "bg-[#0D1117] border-white/10"
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div
              className={`w-3.5 h-3.5 rounded-full ${
                fleetState === "critical"
                  ? "bg-[#EF4444] animate-ping"
                  : fleetState === "degraded"
                  ? "bg-[#F59E0B] animate-pulse"
                  : "bg-[#22C55E]"
              }`}
            />
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>Fleet Status:</span>
                <span
                  className={
                    fleetState === "critical"
                      ? "text-[#EF4444]"
                      : fleetState === "degraded"
                      ? "text-[#F59E0B]"
                      : "text-[#22C55E]"
                  }
                >
                  {fleetState === "critical" ? "CRITICAL ANOMALY DETECTED" : fleetState === "degraded" ? "DEGRADED" : "NOMINAL"}
                </span>
              </h2>
              <p className="text-xs text-[#9AA4B2] mt-0.5">{fleetReason}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono-code">
            <div>
              <span className="text-[#626E7E]">Confidence:</span>{" "}
              <strong className="text-white">
                {activeIncident && typeof activeIncident.confidence === "number"
                  ? `${Math.round(activeIncident.confidence * 100)}%`
                  : "99.8%"}
              </strong>
            </div>
            <div>
              <span className="text-[#626E7E]">Anomaly Score:</span>{" "}
              <strong className={fleetState === "critical" ? "text-red-400" : "text-[#22C55E]"}>
                {typeof activeIncident?.anomaly_score === "number"
                  ? activeIncident.anomaly_score.toFixed(2)
                  : activeIncident
                  ? "0.95"
                  : "0.04"}
              </strong>
            </div>
            <div>
              <span className="text-[#626E7E]">Incident ID:</span>{" "}
              <strong className="text-[#3B82F6]">{activeIncident?.incident_id || "None"}</strong>
            </div>
          </div>
        </div>

        {/* Gemini / Ollama Incident Narration */}
        <div className="pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-8 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#C8F63B]">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Autonomous AI Root Cause Explanation</span>
            </div>
            <p className="text-xs text-white leading-relaxed font-sans">{displayWhyFlagged}</p>

            {displayReasoningPath && (
              <div className="bg-black/40 border border-white/5 rounded-xl p-3 font-mono-code text-[11px] text-[#9AA4B2] space-y-1">
                {displayReasoningPath.map((step: string, i: number) => (
                  <div key={i} className="text-white">{step}</div>
                ))}
              </div>
            )}
          </div>

          <div className="lg:col-span-4 bg-black/60 border border-white/10 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-bold text-[#C8F63B]">
              <span className="uppercase tracking-wider">Human-In-The-Loop Remediation</span>
              <span className="text-[10px] bg-[#C8F63B]/20 text-[#C8F63B] px-1.5 py-0.5 rounded">RUNBOOK</span>
            </div>

            {displaySteps ? (
              <ul className="text-xs text-[#9AA4B2] space-y-1.5 list-disc list-inside leading-relaxed">
                {displaySteps.map((s: string, i: number) => (
                  <li key={i} className="text-white">{s}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-[#626E7E]">Autonomous runbooks standing by.</p>
            )}

            {fleetState === "critical" && (
              <button
                onClick={handleApproveRemediation}
                disabled={remediationApproved}
                className="w-full mt-2 text-xs font-bold bg-[#C8F63B] hover:bg-[#d8ff54] text-[#07090C] py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(200,246,59,0.3)] disabled:opacity-50"
              >
                {remediationApproved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-[#07090C]" />
                    <span>Executing Safe Rollback Runbook...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 text-[#07090C]" />
                    <span>Approve Autonomous Runbook Execution</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 4-Panel Telemetry Grid with Live Sparklines */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Panel 1: CPU */}
        <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-[#C8F63B]" /> CPU Utilization
            </span>
            <span className="text-xs font-mono-code text-[#C8F63B] font-bold">
              {(typeof metrics.cpu_pct === "number" ? metrics.cpu_pct : 1.3).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] font-mono-code text-[#626E7E] mb-3">
            {metrics.cpu_cores || 15} Cores Active • Load: {(typeof metrics.load_1m === "number" ? metrics.load_1m : 0.13).toFixed(2)}
          </p>
          <div className="h-10 w-full overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
              <path d={buildSvgPath(cpuHistory, 40, 200)} fill="none" stroke="#C8F63B" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Panel 2: Memory */}
        <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Server className="w-4 h-4 text-[#3B82F6]" /> Memory Footprint
            </span>
            <span className="text-xs font-mono-code text-[#3B82F6] font-bold">
              {(typeof metrics.mem_pct === "number" ? metrics.mem_pct : 13.8).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] font-mono-code text-[#626E7E] mb-3">
            {metrics.mem_used_mb || 878} MB / {metrics.mem_total_mb || 7935} MB
          </p>
          <div className="h-10 w-full overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
              <path d={buildSvgPath(memHistory, 40, 200)} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* Panel 3: Disk */}
        <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <HardDrive className="w-4 h-4 text-purple-400" /> Persistent Storage
            </span>
            <span className="text-xs font-mono-code text-purple-400 font-bold">
              {(typeof metrics.disk_pct === "number" ? metrics.disk_pct : 1.4).toFixed(1)}%
            </span>
          </div>
          <p className="text-[10px] font-mono-code text-[#626E7E] mb-3">
            {metrics.disk_used_gb || 11.8} GB / {metrics.disk_total_gb || 910.7} GB
          </p>
          <div className="h-10 w-full bg-black/40 rounded-lg p-2 flex items-center">
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
              <div
                className="bg-purple-400 h-full rounded-full transition-all duration-500"
                style={{ width: `${Math.min(typeof metrics.disk_pct === "number" ? metrics.disk_pct : 1.4, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Panel 4: Network */}
        <div className="bg-[#0D1117] border border-white/10 rounded-2xl p-4 hover:border-white/20 transition-all shadow-md">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-bold text-white flex items-center gap-1.5">
              <Wifi className="w-4 h-4 text-emerald-400" /> Network &amp; WAN Probe
            </span>
            <span className="text-xs font-mono-code text-emerald-400 font-bold">
              {(typeof metrics.latency_ms === "number" ? metrics.latency_ms : 0.86).toFixed(2)} ms
            </span>
          </div>
          <p className="text-[10px] font-mono-code text-[#626E7E] mb-3">
            Drop: {(typeof metrics.packet_loss_pct === "number" ? metrics.packet_loss_pct : 0.0).toFixed(2)}% • RX: {(typeof metrics.net_rx_kbps === "number" ? metrics.net_rx_kbps : 4.8).toFixed(1)} kbps
          </p>
          <div className="h-10 w-full overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 200 40" preserveAspectRatio="none">
              <path d={buildSvgPath(netHistory, 40, 200)} fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </section>

      {/* Specialized Studios Quick-Access Cards */}
      <section className="space-y-3 pt-2">
        <h3 className="text-xs font-mono-code text-[#626E7E] uppercase tracking-wider">
          Dedicated Diagnostic &amp; Governance Consoles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Network Studio */}
          <Link
            href="/dashboard/network"
            className="group bg-[#0D1117] border border-white/10 hover:border-blue-500/50 rounded-2xl p-5 transition-all shadow-lg hover:shadow-[0_0_24px_rgba(59,130,246,0.15)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                  <Wifi className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono-code bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded font-bold">
                  STUDIO
                </span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                Network Anomaly &amp; Dev Console Studio
              </h4>
              <p className="text-xs text-[#9AA4B2] mt-1.5 leading-relaxed">
                Diagnose client-side DevTools console fetch failures, 504 timeouts, and CORS errors with copyable AI code runbooks.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-400 mt-4 group-hover:translate-x-1 transition-transform">
              <span>Open Network Studio</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Card 2: Global Regions */}
          <Link
            href="/dashboard/regions"
            className="group bg-[#0D1117] border border-white/10 hover:border-cyan-500/50 rounded-2xl p-5 transition-all shadow-lg hover:shadow-[0_0_24px_rgba(6,182,212,0.15)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:scale-105 transition-transform">
                  <Globe className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono-code bg-cyan-500/15 text-cyan-400 px-2 py-0.5 rounded font-bold">
                  MULTI-REGION
                </span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-cyan-400 transition-colors">
                Global Region &amp; Data Residency
              </h4>
              <p className="text-xs text-[#9AA4B2] mt-1.5 leading-relaxed">
                Inspect ap-south-1 &amp; eu-central-1 sharded instances, trigger live 403 wrong-region attacks, and review zero-row audit proofs.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 mt-4 group-hover:translate-x-1 transition-transform">
              <span>Open Residency Topology</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>

          {/* Card 3: Zero-Leak Privacy */}
          <Link
            href="/dashboard/privacy"
            className="group bg-[#0D1117] border border-white/10 hover:border-[#C8F63B]/50 rounded-2xl p-5 transition-all shadow-lg hover:shadow-[0_0_24px_rgba(200,246,59,0.15)] flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#C8F63B]/10 border border-[#C8F63B]/20 flex items-center justify-center text-[#C8F63B] group-hover:scale-105 transition-transform">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-mono-code bg-[#C8F63B]/15 text-[#C8F63B] px-2 py-0.5 rounded font-bold">
                  TRUST GATE
                </span>
              </div>
              <h4 className="text-sm font-bold text-white group-hover:text-[#C8F63B] transition-colors">
                Zero-Leak Privacy &amp; Cryptographic Audit
              </h4>
              <p className="text-xs text-[#9AA4B2] mt-1.5 leading-relaxed">
                Test Customer Tier 1 local regex scrubbing for canary tokens, review SHA-256 digests, and audit UUIDv7 encrypted batches.
              </p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#C8F63B] mt-4 group-hover:translate-x-1 transition-transform">
              <span>Open Privacy Trust Gate</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </section>
    </div>
  );
}
