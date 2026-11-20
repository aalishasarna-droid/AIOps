"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Wifi,
  Globe,
  Shield,
  Layers,
  Lock,
  Building2,
  X,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  LogIn,
  UserPlus,
} from "lucide-react";
import { useTenant } from "@/context/TenantContext";

interface AppSidebarProps {
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function AppSidebar({
  isCollapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: AppSidebarProps) {
  const pathname = usePathname();
  const {
    currentTenant,
    availableTenants,
    handleSwitchTenant,
    fleetState,
    secondsAgo,
  } = useTenant();

  const navigationSections = [
    {
      title: "OBSERVABILITY",
      items: [
        {
          label: "Fleet Overview",
          sublabel: "Real-time Telemetry & Runbooks",
          href: "/dashboard",
          icon: Activity,
          badge:
            fleetState === "critical"
              ? "CRITICAL"
              : fleetState === "degraded"
              ? "DEGRADED"
              : "NOMINAL",
          badgeColor:
            fleetState === "critical"
              ? "bg-red-500/20 text-red-400 border border-red-500/30"
              : fleetState === "degraded"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
        },
        {
          label: "Network Studio",
          sublabel: "DevTools Console & Latency Chaos",
          href: "/dashboard/network",
          icon: Wifi,
          badge: "DIAG",
          badgeColor: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
        },
      ],
    },
    {
      title: "SECURITY & RESIDENCY",
      items: [
        {
          label: "Global Regions",
          sublabel: "Multi-Node Sharding & Residency",
          href: "/dashboard/regions",
          icon: Globe,
          badge: "2 NODES",
          badgeColor: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",
        },
        {
          label: "Zero-Leak Privacy",
          sublabel: "Gate 1 Egress & Redaction",
          href: "/dashboard/privacy",
          icon: Shield,
          badge: "GATE 1",
          badgeColor: "bg-[#C8F63B]/15 text-[#C8F63B] border border-[#C8F63B]/25",
        },
      ],
    },
    {
      title: "ACCESS & PORTALS",
      items: [
        {
          label: "Sign In",
          sublabel: "Access Tenant Organization",
          href: "/login?tab=signin",
          icon: LogIn,
          badge: "AUTH",
          badgeColor: "bg-blue-500/15 text-blue-400 border border-blue-500/25",
        },
        {
          label: "Create Account",
          sublabel: "Enroll New Isolated Org",
          href: "/login?tab=create",
          icon: UserPlus,
          badge: "NEW ORG",
          badgeColor: "bg-[#C8F63B]/15 text-[#C8F63B] border border-[#C8F63B]/25",
        },
        {
          label: "Ascend 3D Earth",
          sublabel: "Interactive WebGL Globe",
          href: "/",
          icon: Layers,
          badge: "3D",
          badgeColor: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
        },
      ],
    },
  ];

  const renderContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-[#080C14] border-r border-white/10 text-white selection:bg-[#C8F63B] selection:text-[#07090C] transition-all duration-300">
      {/* Brand Header */}
      <div className={`p-4 border-b border-white/10 ${collapsed ? "px-2" : "px-4"}`}>
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="flex items-center gap-3 group min-w-0"
          >
            <div className="w-8 h-8 rounded-xl bg-[#C8F63B] text-[#07090C] flex items-center justify-center font-black text-sm shrink-0 group-hover:scale-105 transition-transform shadow-[0_0_16px_rgba(200,246,59,0.35)]">
              N
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm tracking-tight text-white group-hover:text-[#C8F63B] transition-colors truncate">
                    AIOps Guardian
                  </span>
                  <span className="text-[9px] font-mono-code bg-[#C8F63B]/10 text-[#C8F63B] border border-[#C8F63B]/20 px-1 py-0.2 rounded font-bold shrink-0">
                    v1.4
                  </span>
                </div>
                <p className="text-[10px] text-[#9AA4B2] font-mono-code truncate">
                  Enterprise Observability
                </p>
              </div>
            )}
          </Link>

          {/* Desktop collapse toggle */}
          <button
            onClick={onToggleCollapse}
            className="hidden sm:flex p-1.5 rounded-lg text-[#9AA4B2] hover:text-white hover:bg-white/5 transition-colors shrink-0"
            title={collapsed ? "Expand sidebar menu" : "Collapse to icon rail"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>

          {/* Close button on mobile drawer */}
          <button
            onClick={onCloseMobile}
            className="sm:hidden p-1.5 rounded-lg text-[#9AA4B2] hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Region Chip */}
        {!collapsed && (
          <div className="mt-3 flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono-code">
            <div className="flex items-center gap-1.5 text-[#3B82F6]">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              <span className="font-semibold truncate">{currentTenant.region}</span>
            </div>
            <span className="flex items-center gap-1 text-[#22C55E] text-[10px] shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse" />
              Active Shard
            </span>
          </div>
        )}
      </div>

      {/* Navigation List */}
      <div className={`flex-1 overflow-y-auto py-3 space-y-5 ${collapsed ? "px-2" : "px-3"}`}>
        {navigationSections.map((section) => (
          <div key={section.title} className="space-y-1">
            {!collapsed && (
              <h3 className="px-2.5 text-[9px] font-mono-code font-bold tracking-wider text-[#626E7E] uppercase">
                {section.title}
              </h3>
            )}
            <div className="space-y-1 mt-1">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onCloseMobile}
                    title={collapsed ? `${item.label} (${item.badge})` : undefined}
                    className={`group relative flex items-center rounded-xl text-xs transition-all cursor-pointer pointer-events-auto select-none ${
                      collapsed
                        ? "justify-center p-2.5"
                        : "justify-between px-3 py-2"
                    } ${
                      isActive
                        ? "bg-[#C8F63B]/10 text-white border border-[#C8F63B]/25 shadow-[0_0_16px_rgba(200,246,59,0.08)]"
                        : "text-[#9AA4B2] hover:text-white hover:bg-white/5 border border-transparent"
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-[#C8F63B] shadow-[0_0_8px_#C8F63B]" />
                    )}

                    <div className={`flex items-center gap-2.5 min-w-0 ${collapsed ? "justify-center" : ""}`}>
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? "text-[#C8F63B]"
                            : "text-[#9AA4B2] group-hover:text-white"
                        }`}
                      />
                      {!collapsed && (
                        <div className="truncate min-w-0">
                          <div
                            className={`font-semibold tracking-tight ${
                              isActive ? "text-white font-bold" : "text-[#D0D6E0]"
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[10px] text-[#626E7E] truncate font-mono-code">
                            {item.sublabel}
                          </div>
                        </div>
                      )}
                    </div>

                    {!collapsed && item.badge && (
                      <span
                        className={`text-[9px] font-mono-code px-1.5 py-0.5 rounded font-bold uppercase tracking-wider shrink-0 ml-1.5 ${item.badgeColor}`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer / Tenant Details */}
      <div className={`p-3 border-t border-white/10 bg-[#07090C]/80 space-y-2.5 ${collapsed ? "px-2" : "p-3"}`}>
        {!collapsed ? (
          <>
            {/* Active Tenant Box */}
            <div className="bg-[#0D1117] border border-white/10 rounded-xl p-2.5">
              <div className="flex items-center justify-between text-[10px] font-mono-code text-[#626E7E] mb-1.5">
                <span className="flex items-center gap-1 font-semibold text-[#9AA4B2]">
                  <Building2 className="w-3 h-3 text-[#C8F63B]" />
                  TENANT (RLS)
                </span>
                <span className="text-[#22C55E] flex items-center gap-1 text-[9px]">
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  Isolated
                </span>
              </div>
              <div className="relative">
                <select
                  value={currentTenant.tenant_id}
                  onChange={(e) => handleSwitchTenant(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs font-mono-code text-white focus:outline-none focus:border-[#C8F63B]/50 cursor-pointer appearance-none pr-5 truncate"
                >
                  {availableTenants.map((t) => (
                    <option
                      key={t.tenant_id}
                      value={t.tenant_id}
                      className="bg-[#0D1117] text-white"
                    >
                      {t.name || t.tenant_name} ({t.region})
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-[#9AA4B2] text-[10px]">
                  ▼
                </div>
              </div>

              {/* Quick links to Create Account or Sign In */}
              <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[10px] font-mono-code">
                <Link
                  href="/login?tab=signin"
                  onClick={onCloseMobile}
                  className="text-[#9AA4B2] hover:text-white flex items-center gap-1 transition-colors cursor-pointer pointer-events-auto"
                  title="Sign In to another organization"
                >
                  <LogIn className="w-2.5 h-2.5 text-[#3B82F6]" />
                  <span>Sign In</span>
                </Link>
                <Link
                  href="/login?tab=create"
                  onClick={onCloseMobile}
                  className="text-[#C8F63B] hover:underline flex items-center gap-1 transition-colors font-semibold cursor-pointer pointer-events-auto"
                  title="Enroll a new enterprise tenant"
                >
                  <UserPlus className="w-2.5 h-2.5" />
                  <span>+ Enroll Tenant</span>
                </Link>
              </div>
            </div>

            {/* Live Heartbeat Status */}
            <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] font-mono-code text-[#9AA4B2]">
              <div className="flex items-center gap-2">
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
                <span className="text-xs text-white font-medium">
                  {secondsAgo > 25 ? `Lag (${secondsAgo}s)` : `Live (${secondsAgo}s)`}
                </span>
              </div>
              <span className="text-[9px] text-[#C8F63B] font-semibold bg-[#C8F63B]/10 px-1.5 py-0.5 rounded">
                Zero Leak
              </span>
            </div>
          </>
        ) : (
          /* Collapsed Footnote Icons */
          <div className="flex flex-col items-center gap-2.5 py-1">
            <Link
              href="/login?tab=signin"
              className="p-2 rounded-lg text-[#9AA4B2] hover:text-white hover:bg-white/5 transition-colors cursor-pointer pointer-events-auto"
              title="Sign In to Tenant"
            >
              <LogIn className="w-4 h-4 text-[#3B82F6]" />
            </Link>
            <Link
              href="/login?tab=create"
              className="p-2 rounded-lg text-[#C8F63B] hover:bg-white/5 transition-colors cursor-pointer pointer-events-auto"
              title="Create Account / Enroll Tenant"
            >
              <UserPlus className="w-4 h-4" />
            </Link>
            <div className="w-4 border-t border-white/10 my-0.5" />
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                fleetState === "critical"
                  ? "bg-[#EF4444] animate-ping"
                  : fleetState === "degraded"
                  ? "bg-[#F59E0B] animate-pulse"
                  : "bg-[#22C55E]"
              }`}
              title={`Heartbeat: ${secondsAgo}s`}
            />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Permanent Sidebar Menu Bar (Visible on sm: 640px and up) */}
      <aside
        className={`hidden sm:flex flex-col h-screen sticky top-0 shrink-0 z-40 transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-60"
        }`}
      >
        {renderContent(isCollapsed)}
      </aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 sm:hidden transition-opacity"
        />
      )}

      {/* Mobile Slide-Over Drawer */}
      <div
        className={`fixed inset-y-0 left-0 w-72 max-w-[85vw] z-50 sm:hidden transform transition-transform duration-300 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {renderContent(false)}
      </div>
    </>
  );
}
