"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Globe, Building2, Lock, Activity, Wifi, Shield,
  Layers, Server
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";

export default function AppHeader() {
  const pathname = usePathname();
  const {
    currentTenant,
    availableTenants,
    handleSwitchTenant,
    fleetState,
    secondsAgo,
    currentTime,
  } = useTenant();

  const navItems = [
    {
      label: "Fleet Overview",
      href: "/dashboard",
      icon: Activity,
      badge: fleetState === "critical" ? "CRITICAL" : fleetState === "degraded" ? "DEGRADED" : "NOMINAL",
      badgeColor: fleetState === "critical" ? "bg-red-500/20 text-red-400" : fleetState === "degraded" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400",
    },
    {
      label: "Network Studio",
      href: "/dashboard/network",
      icon: Wifi,
      badge: "DEV TOOLS",
      badgeColor: "bg-blue-500/15 text-blue-400",
    },
    {
      label: "Global Regions",
      href: "/dashboard/regions",
      icon: Globe,
      badge: "2 NODES",
      badgeColor: "bg-cyan-500/15 text-cyan-400",
    },
    {
      label: "Zero-Leak Privacy",
      href: "/dashboard/privacy",
      icon: Shield,
      badge: "GATE 1",
      badgeColor: "bg-lime-500/15 text-lime-400",
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-[#07090C]/80 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 lg:px-8 py-3.5 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Brand & Active Tenant Identity */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-[#C8F63B] text-[#07090C] flex items-center justify-center font-black text-sm group-hover:scale-105 transition-transform shadow-[0_0_16px_rgba(200,246,59,0.35)]">
              N
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight text-white group-hover:text-[#C8F63B] transition-colors">
                  AIOps Guardian
                </span>
                <span className="text-xs text-[#9AA4B2] font-normal hidden sm:inline">
                  // Enterprise Observability
                </span>
                <span className="text-[10px] font-mono-code bg-white/5 border border-white/10 text-[#3B82F6] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                  <Globe className="w-2.5 h-2.5" />
                  {currentTenant.region}
                </span>
              </div>
              <div className="text-[11px] font-mono-code text-[#626E7E] flex items-center gap-2 mt-0.5">
                <span>Tenant: <strong className="text-white">{currentTenant.tenant_name}</strong></span>
                <span>•</span>
                <span className="text-[#22C55E]">RLS Enforced</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-[#0D1117]/90 border border-white/10 p-1 rounded-xl overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-[#C8F63B] text-[#07090C] shadow-[0_0_12px_rgba(200,246,59,0.25)] font-bold"
                    : "text-[#9AA4B2] hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-[#07090C]" : "text-[#9AA4B2]"}`} />
                <span>{item.label}</span>
                {item.badge && (
                  <span
                    className={`text-[9px] font-mono-code px-1.5 py-0.2 rounded font-bold uppercase tracking-wider ${
                      isActive ? "bg-black/20 text-[#07090C]" : item.badgeColor
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Global Controls & Status */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          {/* Tenant Switcher Dropdown */}
          <div className="flex items-center gap-1.5 bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5">
            <Building2 className="w-3.5 h-3.5 text-[#C8F63B]" />
            <select
              value={currentTenant.tenant_id}
              onChange={(e) => handleSwitchTenant(e.target.value)}
              className="bg-transparent text-xs font-mono-code text-white focus:outline-none cursor-pointer"
            >
              {availableTenants.map((t) => (
                <option key={t.tenant_id} value={t.tenant_id} className="bg-[#0D1117] text-white">
                  {t.name || t.tenant_name} ({t.region})
                </option>
              ))}
            </select>
          </div>

          {/* Telemetry Status Pulse */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-mono-code text-[#9AA4B2]">
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
              {secondsAgo > 25 ? `STALE (${secondsAgo}s)` : `Live (${secondsAgo}s)`}
            </span>
          </div>

          {/* UTC Clock */}
          <div className="text-xs font-mono-code text-[#9AA4B2] bg-white/5 border border-white/10 px-2.5 py-1.5 rounded-lg hidden md:block">
            {currentTime || "18:00:00 UTC"}
          </div>

          {/* Portal Switch */}
          <Link
            href="/login"
            className="text-xs font-semibold bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Lock className="w-3.5 h-3.5 text-[#3B82F6]" />
            <span className="hidden sm:inline">Switch Portal</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
