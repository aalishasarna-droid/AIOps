"use client";

import React, { useState, useEffect } from "react";
import { TenantProvider } from "@/context/TenantContext";
import AppSidebar from "@/components/AppSidebar";
import AppTopBar from "@/components/AppTopBar";

function AppShell({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aiops_sidebar_collapsed");
      if (stored === "true") {
        setIsCollapsed(true);
      }
    }
  }, []);

  const handleToggleSidebar = () => {
    if (typeof window !== "undefined" && window.innerWidth < 640) {
      setMobileOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => {
        const next = !prev;
        if (typeof window !== "undefined") {
          localStorage.setItem("aiops_sidebar_collapsed", String(next));
        }
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#07090C] text-white flex font-sans selection:bg-[#C8F63B] selection:text-[#07090C]">
      {/* Permanent Sidebar Menu Bar */}
      <AppSidebar
        isCollapsed={isCollapsed}
        onToggleCollapse={handleToggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <AppTopBar
          isCollapsed={isCollapsed}
          onToggleSidebar={handleToggleSidebar}
        />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 w-full max-w-[1700px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <AppShell>{children}</AppShell>
    </TenantProvider>
  );
}
