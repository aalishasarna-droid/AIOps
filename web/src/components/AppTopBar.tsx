"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Menu,
  Globe,
  Building2,
  Lock,
  Activity,
  Wifi,
  Shield,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  LogIn,
  UserPlus,
  ShieldCheck,
  LogOut,
  HeartPulse,
  FlaskConical,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";
import { useAudioAlerts } from "@/context/AudioAlertContext";
import ThemeToggle from "@/components/ThemeToggle";

interface AppTopBarProps {
  isCollapsed: boolean;
  onToggleSidebar: () => void;
}

export default function AppTopBar({ isCollapsed, onToggleSidebar }: AppTopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    currentTenant,
    availableTenants,
    handleSwitchTenant,
    fleetState,
    secondsAgo,
    currentTime,
    isAuthenticated,
    logout,
  } = useTenant();
  const { audioEnabled, toggleAudioAlerts } = useAudioAlerts();

  const getBreadcrumbs = () => {
    switch (pathname) {
      case "/dashboard/network":
        return {
          section: "Observability",
          title: "Network Studio",
          subtitle: "DevTools Console & Latency Diagnostics",
          icon: Wifi,
          iconColor: "text-blue-400",
        };
      case "/dashboard/regions":
        return {
          section: "Infrastructure",
          title: "Global Regions",
          subtitle: "Multi-Node Sharding & Residency Audit",
          icon: Globe,
          iconColor: "text-cyan-400",
        };
      case "/dashboard/privacy":
        return {
          section: "Security",
          title: "Zero-Leak Privacy Gate",
          subtitle: "Canonical Cryptographic Egress Trail",
          icon: Shield,
          iconColor: "text-[#C8F63B]",
        };
      case "/dashboard/health":
        return {
          section: "Observability",
          title: "System Health Diagnostics",
          subtitle: "Enterprise Health States · Excellent · Good · Fair · Poor",
          icon: HeartPulse,
          iconColor: "text-emerald-400",
        };
      case "/dashboard/simulator":
        return {
          section: "Observability",
          title: "Simulation Lab",
          subtitle: "End-to-End Fleet Chaos & AI Remediation",
          icon: FlaskConical,
          iconColor: "text-amber-400",
        };
      case "/dashboard":
      default:
        return {
          section: "Observability",
          title: "Fleet Overview",
          subtitle: "Real-time Telemetry & Autonomous Remediation",
          icon: Activity,
          iconColor: "text-[#C8F63B]",
        };
    }
  };

  const breadcrumb = getBreadcrumbs();
  const Icon = breadcrumb.icon;

  return (
    <header className="sticky top-0 z-30 bg-[#07090C]/85 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 py-3 mb-6 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Sidebar Toggle Button + Context Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-[#9AA4B2] hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title={isCollapsed ? "Expand sidebar menu" : "Collapse sidebar menu"}
            aria-label="Toggle sidebar menu"
          >
            {isCollapsed ? (
              <PanelLeft className="w-4 h-4 text-[#C8F63B]" />
            ) : (
              <PanelLeftClose className="w-4 h-4 text-[#9AA4B2]" />
            )}
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 hidden sm:flex items-center justify-center shrink-0">
              <Icon className={`w-4 h-4 ${breadcrumb.iconColor}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] font-mono-code text-[#626E7E]">
                <span>{breadcrumb.section}</span>
                <ChevronRight className="w-3 h-3 text-zinc-600 shrink-0" />
                <span className="text-[#9AA4B2] truncate font-medium">
                  {breadcrumb.title}
                </span>
              </div>
              <h1 className="text-sm font-bold tracking-tight text-white truncate">
                {breadcrumb.subtitle}
              </h1>
            </div>
          </div>
        </div>

        {/* Right: Tenant, Pulse, Clock, Portal link */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Tenant Switcher Pill */}
          <div className="hidden md:flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#C8F63B]" />
            <select
              value={currentTenant.tenant_id}
              onChange={(e) => handleSwitchTenant(e.target.value)}
              className="bg-transparent text-xs font-mono-code text-white focus:outline-none cursor-pointer max-w-[150px] truncate"
            >
              {availableTenants.map((t) => (
                <option
                  key={t.tenant_id}
                  value={t.tenant_id}
                  className="bg-[#0D1117] text-white"
                >
                  {t.name || t.tenant_name}
                </option>
              ))}
            </select>
          </div>

          {/* Telemetry Status Pulse */}
          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono-code text-[#9AA4B2]">
            <span
              className={`w-2 h-2 rounded-full ${
                fleetState === "critical"
                  ? "bg-[#EF4444] animate-ping"
                  : fleetState === "degraded"
                  ? "bg-[#F59E0B] animate-pulse"
                  : secondsAgo > 25
                  ? "bg-[#F59E0B]"
                  : "bg-[#22C55E]"
              }`}
            />
            <span className="hidden sm:inline">
              {secondsAgo > 25 ? `Stale (${secondsAgo}s)` : `Live (${secondsAgo}s)`}
            </span>
          </div>

          {/* UTC Clock */}
          <div className="text-xs font-mono-code text-[#9AA4B2] bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg hidden lg:block">
            {currentTime || "18:00:00 UTC"}
          </div>

          {/* Audio Alerts: ON / OFF Toggle Button */}
          <button
            id="btn-audio-toggle"
            onClick={toggleAudioAlerts}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold select-none cursor-pointer active:scale-95 transition-all duration-200 border ${
              audioEnabled
                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/35 hover:bg-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.18)]"
                : "bg-white/5 text-[#9AA4B2] border-white/10 hover:bg-white/10 hover:text-white"
            }`}
            title={
              audioEnabled
                ? "Audio Alerts: ON (Web Audio Anomaly Chime Active — Click to Mute)"
                : "Audio Alerts: OFF (Web Audio Anomaly Chime Muted — Click to Enable)"
            }
            aria-label="Toggle Audio Alerts"
          >
            <span className="text-sm leading-none">{audioEnabled ? "🔊" : "🔇"}</span>
            <span className="hidden sm:inline">Audio Alerts:</span>
            <span
              className={`font-mono-code font-bold ${
                audioEnabled ? "text-emerald-300" : "text-zinc-400"
              }`}
            >
              {audioEnabled ? "ON" : "OFF"}
            </span>
          </button>

          {/* Theme Mode Toggle */}
          <ThemeToggle compact />

          {/* Auth State: Signed In Profile & Sign Out OR Sign In / Create Account */}
          <div className="flex items-center gap-2 relative z-50">
            {isAuthenticated ? (
              <div className="flex items-center gap-2">
                {/* Active Session Badge */}
                <div className="flex items-center gap-2 bg-[#0D1117] border border-[#22C55E]/30 rounded-lg px-2.5 py-1.5 shadow-[0_0_12px_rgba(34,197,94,0.1)]">
                  <div className="w-2 h-2 rounded-full bg-[#22C55E] animate-pulse shrink-0" />
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C8F63B] shrink-0" />
                  <div className="flex flex-col text-left min-w-0">
                    <span className="text-[11px] font-bold text-white tracking-tight leading-tight truncate max-w-[120px]">
                      {currentTenant.tenant_name || currentTenant.name || "Authenticated"}
                    </span>
                    <span className="text-[9px] font-mono-code text-[#C8F63B] leading-none mt-0.5">
                      VERIFIED AUTH
                    </span>
                  </div>
                </div>

                {/* Sign Out Button */}
                <button
                  id="btn-topbar-signout"
                  onClick={() => {
                    logout();
                    router.push("/login?tab=signin");
                  }}
                  className="text-xs font-semibold bg-white/5 hover:bg-red-500/15 text-[#9AA4B2] hover:text-red-400 border border-white/10 hover:border-red-500/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto"
                  title="Sign Out of Active Tenant Session"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <>
                <Link
                  id="btn-topbar-signin"
                  href="/login?tab=signin"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/login?tab=signin");
                  }}
                  className="text-xs font-semibold bg-white/5 hover:bg-white/10 text-[#9AA4B2] hover:text-white border border-white/10 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer relative z-50 pointer-events-auto"
                  title="Sign In to Tenant Organization"
                >
                  <LogIn className="w-3.5 h-3.5 text-[#3B82F6]" />
                  <span className="hidden sm:inline">Sign In</span>
                </Link>
                <Link
                  id="btn-topbar-create"
                  href="/login?tab=create"
                  onClick={(e) => {
                    e.preventDefault();
                    router.push("/login?tab=create");
                  }}
                  className="text-xs font-bold bg-[#C8F63B]/10 hover:bg-[#C8F63B]/20 text-[#C8F63B] border border-[#C8F63B]/30 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-all whitespace-nowrap shadow-[0_0_12px_rgba(200,246,59,0.12)] hover:shadow-[0_0_16px_rgba(200,246,59,0.25)] cursor-pointer relative z-50 pointer-events-auto"
                  title="Create New Tenant Account"
                >
                  <UserPlus className="w-3.5 h-3.5 text-[#C8F63B]" />
                  <span className="hidden md:inline">Create Account</span>
                  <span className="md:hidden">Join</span>
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
