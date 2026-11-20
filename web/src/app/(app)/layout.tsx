"use client";

import React from "react";
import { TenantProvider } from "@/context/TenantContext";
import AppHeader from "@/components/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TenantProvider>
      <div className="min-h-screen bg-[#07090C] text-white flex flex-col font-sans selection:bg-[#C8F63B] selection:text-[#07090C]">
        <AppHeader />
        <main className="flex-1 px-4 sm:px-6 lg:px-8 pb-12 max-w-[1700px] w-full mx-auto">
          {children}
        </main>
      </div>
    </TenantProvider>
  );
}
