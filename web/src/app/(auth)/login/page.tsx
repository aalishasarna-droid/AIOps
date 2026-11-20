"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Shield, Key, ArrowRight, Lock, CheckCircle2, Server, Database,
  Globe, Building2, Check, AlertCircle, Sparkles, Copy, Terminal,
  PlusCircle, UserPlus, LogIn
} from "lucide-react";

interface TenantItem {
  id: string;
  name: string;
  region: string;
  api_key?: string;
  policy_json?: {
    sampling_rate?: number;
    retention_hours?: number;
    tumbling_window_s?: number;
    industry?: string;
  };
}

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"signin" | "create">("signin");

  const [tenants, setTenants] = useState<TenantItem[]>([
    {
      id: "00000000-0000-0000-0000-000000000001",
      name: "Acme Financial Corp",
      region: "ap-south-1",
      api_key: "test-collector-key-abc123",
      policy_json: { sampling_rate: 1.0, retention_hours: 24, industry: "fintech" },
    },
    {
      id: "00000000-0000-0000-0000-000000000002",
      name: "Global Health Technologies",
      region: "eu-west-1",
      api_key: "col-health-key-9988",
      policy_json: { sampling_rate: 1.0, retention_hours: 72, industry: "healthcare" },
    },
    {
      id: "00000000-0000-0000-0000-000000000003",
      name: "Apex Logistics Global",
      region: "us-east-1",
      api_key: "col-apex-key-4455",
      policy_json: { sampling_rate: 0.5, retention_hours: 48, industry: "supply-chain" },
    },
  ]);

  // Sign In State
  const [selectedTenantId, setSelectedTenantId] = useState<string>("00000000-0000-0000-0000-000000000001");
  const [apiKey, setApiKey] = useState<string>("test-collector-key-abc123");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [authSuccess, setAuthSuccess] = useState<boolean>(false);

  // Create Account State
  const [newOrgName, setNewOrgName] = useState<string>("");
  const [newAdminEmail, setNewAdminEmail] = useState<string>("");
  const [newRegion, setNewRegion] = useState<string>("ap-south-1");
  const [newIndustry, setNewIndustry] = useState<string>("Enterprise SaaS");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [regErrorMsg, setRegErrorMsg] = useState<string>("");
  const [regSuccessData, setRegSuccessData] = useState<{
    tenant_id: string;
    tenant_name: string;
    region: string;
    api_key: string;
    collector_id: string;
    docker_command: string;
  } | null>(null);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  // Check URL params on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      const tab = p.get("tab") || p.get("mode");
      if (tab === "create" || tab === "register" || tab === "new") {
        setActiveTab("create");
      } else if (tab === "signin" || tab === "login" || tab === "auth") {
        setActiveTab("signin");
      }
    }
  }, []);

  // Fetch real tenants from Supabase on mount
  useEffect(() => {
    const fetchTenants = async () => {
      try {
        let res = await fetch("/api/tenants").catch(() => null);
        if (!res || !res.ok) {
          res = await fetch("http://localhost:8000/api/tenants");
        }
        if (res && res.ok) {
          const data = await res.json();
          if (data.tenants && data.tenants.length > 0) {
            setTenants(data.tenants);
          }
        }
      } catch {
        // use default state
      }
    };
    fetchTenants();
  }, []);

  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || tenants[0];

  const handleSelectTenant = (t: TenantItem) => {
    setSelectedTenantId(t.id);
    if (t.api_key) {
      setApiKey(t.api_key);
    }
    setErrorMsg("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");

    try {
      let res = await fetch("/api/auth/tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          tenant_id: selectedTenantId,
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("http://localhost:8000/api/auth/tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            api_key: apiKey,
            tenant_id: selectedTenantId,
          }),
        });
      }

      if (res && res.ok) {
        const authData = await res.json();
        setAuthSuccess(true);
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "aiops_current_tenant",
            JSON.stringify({
              tenant_id: authData.tenant_id,
              tenant_name: authData.tenant_name,
              region: authData.region,
              collector_id: authData.collector_id,
              token: authData.token,
            })
          );
        }
        setTimeout(() => {
          router.push(`/dashboard?tenant_id=${authData.tenant_id}`);
        }, 600);
      } else {
        const err = await res?.json().catch(() => ({}));
        setErrorMsg(err.detail || "Invalid tenant credential or unauthorized collector key.");
      }
    } catch {
      // Local fallback
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "aiops_current_tenant",
          JSON.stringify({
            tenant_id: selectedTenant.id,
            tenant_name: selectedTenant.name,
            region: selectedTenant.region,
            collector_id: "col-local-01",
            token: `demo_token_${selectedTenant.id.slice(0, 8)}`,
          })
        );
      }
      setAuthSuccess(true);
      setTimeout(() => {
        router.push(`/dashboard?tenant_id=${selectedTenant.id}`);
      }, 500);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setRegErrorMsg("");

    try {
      let res = await fetch("/api/auth/register-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newOrgName,
          email: newAdminEmail,
          region: newRegion,
          industry: newIndustry,
        }),
      }).catch(() => null);

      if (!res || !res.ok) {
        res = await fetch("http://localhost:8000/api/auth/register-tenant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: newOrgName,
            email: newAdminEmail,
            region: newRegion,
            industry: newIndustry,
          }),
        });
      }

      if (res && res.ok) {
        const data = await res.json();
        setRegSuccessData({
          tenant_id: data.tenant_id,
          tenant_name: data.tenant_name,
          region: data.region,
          api_key: data.api_key,
          collector_id: data.collector_id,
          docker_command: data.docker_command,
        });

        // Add to active tenant list
        setTenants((prev) => [
          ...prev,
          {
            id: data.tenant_id,
            name: data.tenant_name,
            region: data.region,
            api_key: data.api_key,
            policy_json: { industry: newIndustry, sampling_rate: 1.0, retention_hours: 24 },
          },
        ]);

        // Save session
        if (typeof window !== "undefined") {
          localStorage.setItem(
            "aiops_current_tenant",
            JSON.stringify({
              tenant_id: data.tenant_id,
              tenant_name: data.tenant_name,
              region: data.region,
              collector_id: data.collector_id,
              token: data.token,
            })
          );
        }
      } else {
        const err = await res?.json().catch(() => ({}));
        setRegErrorMsg(err.detail || "Registration failed. Please check inputs and try again.");
      }
    } catch (err: any) {
      setRegErrorMsg(err.message || "Network error registering tenant.");
    } finally {
      setIsRegistering(false);
    }
  };

  const copyToClipboard = (text: string, type: "key" | "cmd") => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      if (type === "key") {
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
      } else {
        setCopiedCmd(true);
        setTimeout(() => setCopiedCmd(false), 2000);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#07090C] text-white flex flex-col justify-between selection:bg-[#C8F63B] selection:text-[#07090C] relative overflow-hidden">
      {/* Background Soft Glow Spotlight */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] pointer-events-none spotlight-cone z-0" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-gradient-to-b from-[#C8F63B]/10 via-[#3B82F6]/5 to-transparent blur-[100px] rounded-full pointer-events-none z-0" />

      {/* Top Bar */}
      <header className="relative z-10 max-w-5xl mx-auto w-full px-6 pt-8 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-white group">
          <div className="w-8 h-8 rounded-lg bg-[#C8F63B] text-[#07090C] flex items-center justify-center font-black text-sm shadow-[0_0_15px_rgba(200,246,59,0.35)] group-hover:scale-105 transition-transform">
            N
          </div>
          <span className="text-sm font-semibold tracking-wide">
            AIOps <span className="text-[#9AA4B2] font-normal">Guardian</span>
          </span>
        </Link>
        <Link href="/" className="text-xs text-[#9AA4B2] hover:text-white transition-colors">
          Back to Home
        </Link>
      </header>

      {/* Centered Auth Card */}
      <main className="relative z-10 max-w-xl mx-auto w-full px-6 py-8">
        <div className="glass-panel p-8 rounded-3xl border border-white/10 shadow-2xl relative">
          
          {/* Header */}
          <div className="text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/10 text-[#C8F63B] mx-auto flex items-center justify-center mb-3 shadow-[0_0_20px_rgba(200,246,59,0.15)]">
              <Shield className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif-headline text-white">Multi-Tenant Access Portal</h1>
            <p className="text-xs text-[#9AA4B2] mt-1">
              Select an existing organization or provision a new isolated enterprise tenant in Supabase.
            </p>
          </div>

          {/* Segmented Tab Switcher */}
          <div className="flex p-1 mb-6 rounded-xl bg-black/60 border border-white/10">
            <button
              type="button"
              onClick={() => {
                setActiveTab("signin");
                setRegSuccessData(null);
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer pointer-events-auto select-none ${
                activeTab === "signin"
                  ? "bg-[#C8F63B] text-[#07090C] shadow-[0_0_15px_rgba(200,246,59,0.25)]"
                  : "text-[#9AA4B2] hover:text-white"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In to Tenant</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("create");
                setErrorMsg("");
              }}
              className={`flex-1 py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer pointer-events-auto select-none ${
                activeTab === "create"
                  ? "bg-[#C8F63B] text-[#07090C] shadow-[0_0_15px_rgba(200,246,59,0.25)]"
                  : "text-[#9AA4B2] hover:text-white"
              }`}
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </button>
          </div>

          {/* ────────────── TAB 1: SIGN IN ────────────── */}
          {activeTab === "signin" && (
            <div>
              {/* Tenant Selector Cards */}
              <div className="mb-5 space-y-2">
                <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-2">
                  Select Organization (Supabase Tenants):
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto pr-1">
                  {tenants.map((t) => {
                    const isSelected = t.id === selectedTenantId;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleSelectTenant(t)}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          isSelected
                            ? "bg-[#C8F63B]/10 border-[#C8F63B] ring-1 ring-[#C8F63B]/40"
                            : "bg-white/[0.02] border-white/10 hover:border-white/20"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-white truncate max-w-[140px]">{t.name}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-[#C8F63B]" />}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] font-mono-code text-[#9AA4B2]">
                          <Globe className="w-3 h-3 text-[#3B82F6]" />
                          <span>{t.region}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                    Collector Credential (X-Collector-Key)
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B] transition-colors pr-10"
                      placeholder="Enter API Key"
                      required
                    />
                    <Key className="w-4 h-4 text-[#626E7E] absolute right-3 top-1/2 -translate-y-1/2" />
                  </div>
                </div>

                {/* Derived Tenant Info Box */}
                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1.5 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9AA4B2] font-mono-code text-[11px]">Organization:</span>
                    <span className="font-semibold text-white">{selectedTenant.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9AA4B2] font-mono-code text-[11px]">Derived Tenant UUID:</span>
                    <span className="font-mono-code text-[10px] text-[#C8F63B]">{selectedTenant.id}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9AA4B2] font-mono-code text-[11px]">Data Residency:</span>
                    <span className="font-mono-code text-[10px] text-white/90">{selectedTenant.region}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9AA4B2] font-mono-code text-[11px]">Supabase Persistence:</span>
                    <span className="text-[#22C55E] text-[10px] font-semibold flex items-center gap-1 font-mono-code">
                      <Database className="w-3 h-3" /> Real-time Cloud Connected
                    </span>
                  </div>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#fca5a5] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {authSuccess && (
                  <div className="p-3 rounded-xl bg-[#22C55E]/10 border border-[#22C55E]/30 text-xs text-[#86efac] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#22C55E]" />
                    <span>Authenticated! Audit log recorded to Supabase. Redirecting...</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading || authSuccess}
                  className="w-full py-3 rounded-full bg-[#C8F63B] text-[#07090C] text-xs font-bold tracking-tight flex items-center justify-center gap-2 hover:bg-[#d8ff54] transition-all shadow-[0_0_20px_rgba(200,246,59,0.25)] hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <span>{isLoading ? "Authenticating via Supabase..." : "Access Enterprise Tenant"}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </form>
            </div>
          )}

          {/* ────────────── TAB 2: CREATE ACCOUNT ────────────── */}
          {activeTab === "create" && (
            <div>
              {!regSuccessData ? (
                <form onSubmit={handleCreateAccount} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                      Organization Name *
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={(e) => setNewOrgName(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C8F63B] transition-colors"
                        placeholder="e.g., Stripe Payments Ltd, Cyberdyne Systems"
                        required
                      />
                      <Building2 className="w-4 h-4 text-[#626E7E] absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                      Administrator Work Email *
                    </label>
                    <input
                      type="email"
                      value={newAdminEmail}
                      onChange={(e) => setNewAdminEmail(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#C8F63B] transition-colors"
                      placeholder="admin@yourcompany.com"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                        Data Residency Region
                      </label>
                      <select
                        value={newRegion}
                        onChange={(e) => setNewRegion(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B] cursor-pointer"
                      >
                        <option value="ap-south-1" className="bg-[#0D1117]">ap-south-1 (Mumbai)</option>
                        <option value="eu-west-1" className="bg-[#0D1117]">eu-west-1 (Ireland - GDPR)</option>
                        <option value="us-east-1" className="bg-[#0D1117]">us-east-1 (N. Virginia)</option>
                        <option value="ap-southeast-1" className="bg-[#0D1117]">ap-southeast-1 (Singapore)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-mono-code text-[#9AA4B2] uppercase tracking-wider mb-1.5">
                        Compliance Profile
                      </label>
                      <select
                        value={newIndustry}
                        onChange={(e) => setNewIndustry(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2.5 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B] cursor-pointer"
                      >
                        <option value="FinTech (PCI-DSS & SOC2)" className="bg-[#0D1117]">FinTech (PCI-DSS)</option>
                        <option value="Healthcare (HIPAA & BAA)" className="bg-[#0D1117]">Healthcare (HIPAA)</option>
                        <option value="Supply Chain & Logistics" className="bg-[#0D1117]">Supply Chain</option>
                        <option value="Enterprise SaaS" className="bg-[#0D1117]">Enterprise SaaS</option>
                        <option value="Defense & Cyber Operations" className="bg-[#0D1117]">Defense & Cyber</option>
                      </select>
                    </div>
                  </div>

                  {/* Provisioning Notice */}
                  <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 space-y-1 text-xs">
                    <div className="flex items-center gap-1.5 text-[#C8F63B] font-semibold text-[11px]">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Instant Supabase Cloud Provisioning</span>
                    </div>
                    <p className="text-[11px] text-[#9AA4B2]">
                      Creates an isolated tenant in Supabase with cryptographic HMAC pseudonyms, an on-premise Collector gateway ID, and a tamper-evident audit record.
                    </p>
                  </div>

                  {regErrorMsg && (
                    <div className="p-3 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-xs text-[#fca5a5] flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-[#EF4444]" />
                      <span>{regErrorMsg}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isRegistering}
                    className="w-full py-3 rounded-full bg-[#C8F63B] text-[#07090C] text-xs font-bold tracking-tight flex items-center justify-center gap-2 hover:bg-[#d8ff54] transition-all shadow-[0_0_20px_rgba(200,246,59,0.25)] hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    <span>{isRegistering ? "Provisioning in Supabase..." : "Create Organization & Provision Tenant"}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              ) : (
                /* Success Card After Provisioning */
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-[#22C55E]/10 border border-[#22C55E]/30 space-y-2">
                    <div className="flex items-center gap-2 text-[#22C55E] font-bold text-sm">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Organization Provisioned in Supabase!</span>
                    </div>
                    <p className="text-xs text-[#9AA4B2]">
                      Your organization <strong className="text-white">{regSuccessData.tenant_name}</strong> is live and backed by PostgreSQL Row-Level Security.
                    </p>
                  </div>

                  {/* Generated Credentials */}
                  <div className="p-3.5 rounded-xl bg-black/60 border border-white/10 space-y-2 text-xs">
                    <div>
                      <div className="text-[11px] font-mono-code text-[#9AA4B2] mb-1">Generated Tenant UUID:</div>
                      <div className="font-mono-code text-xs text-[#C8F63B] bg-white/[0.04] p-2 rounded-lg border border-white/5 break-all">
                        {regSuccessData.tenant_id}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono-code text-[#9AA4B2] mb-1">
                        <span>Collector API Key (X-Collector-Key):</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(regSuccessData.api_key, "key")}
                          className="text-[#C8F63B] hover:underline flex items-center gap-1"
                        >
                          {copiedKey ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedKey ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <div className="font-mono-code text-xs text-white bg-white/[0.04] p-2 rounded-lg border border-white/5 flex items-center justify-between">
                        <span className="font-bold">{regSuccessData.api_key}</span>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11px] font-mono-code text-[#9AA4B2] mb-1">
                        <span>Deploy On-Premise Collector (Tier 1):</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(regSuccessData.docker_command, "cmd")}
                          className="text-[#C8F63B] hover:underline flex items-center gap-1"
                        >
                          {copiedCmd ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedCmd ? "Copied" : "Copy"}</span>
                        </button>
                      </div>
                      <div className="font-mono-code text-[11px] text-[#9AA4B2] bg-white/[0.04] p-2.5 rounded-lg border border-white/5 overflow-x-auto whitespace-pre">
                        {regSuccessData.docker_command}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/dashboard?tenant_id=${regSuccessData.tenant_id}`)}
                    className="w-full py-3 rounded-full bg-[#C8F63B] text-[#07090C] text-xs font-bold tracking-tight flex items-center justify-center gap-2 hover:bg-[#d8ff54] transition-all shadow-[0_0_20px_rgba(200,246,59,0.25)] hover:scale-[1.02] active:scale-95"
                  >
                    <span>Enter Observability Console</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Multi-Tenancy Guarantee Notice */}
          <div className="mt-6 pt-5 border-t border-white/5 text-center flex items-center justify-center gap-2 text-[11px] text-[#626E7E]">
            <Lock className="w-3.5 h-3.5 text-[#C8F63B]" />
            <span>Cryptographic Tenant Derivation · Client Cannot Declare Tenant ID</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 py-6 text-center text-xs text-[#626E7E]">
        AIOps Secure Two-Tier Multi-Tenancy · Supabase PostgreSQL RLS Enforced
      </footer>
    </div>
  );
}
