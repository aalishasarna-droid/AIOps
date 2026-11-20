"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";

export interface TenantProfile {
  tenant_id: string;
  tenant_name: string;
  name?: string;
  region: string;
  collector_id: string;
}

export const DEFAULT_TENANTS: TenantProfile[] = [
  {
    tenant_id: "00000000-0000-0000-0000-000000000001",
    tenant_name: "Acme Financial Corp",
    region: "ap-south-1",
    collector_id: "00000000-0000-0000-0000-000000000010",
  },
  {
    tenant_id: "00000000-0000-0000-0000-000000000002",
    tenant_name: "Global Health Technologies",
    region: "eu-central-1",
    collector_id: "00000000-0000-0000-0000-000000000020",
  },
  {
    tenant_id: "00000000-0000-0000-0000-000000000003",
    tenant_name: "Apex Logistics Global",
    region: "us-east-1",
    collector_id: "00000000-0000-0000-0000-000000000030",
  },
];

interface TenantContextType {
  currentTenant: TenantProfile;
  setCurrentTenant: React.Dispatch<React.SetStateAction<TenantProfile>>;
  availableTenants: TenantProfile[];
  handleSwitchTenant: (tenantId: string) => void;
  fleetState: string;
  setFleetState: React.Dispatch<React.SetStateAction<string>>;
  secondsAgo: number;
  setSecondsAgo: React.Dispatch<React.SetStateAction<number>>;
  currentTime: string;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const [currentTenant, setCurrentTenant] = useState<TenantProfile>(DEFAULT_TENANTS[0]);
  const [availableTenants, setAvailableTenants] = useState<TenantProfile[]>(DEFAULT_TENANTS);
  const [fleetState, setFleetState] = useState<string>("healthy");
  const [secondsAgo, setSecondsAgo] = useState<number>(3);
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("aiops_current_tenant");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed.tenant_id) {
            setCurrentTenant(parsed);
          }
        } catch {
          // ignore
        }
      }
      const urlParams = new URLSearchParams(window.location.search);
      const qTenantId = urlParams.get("tenant_id");
      if (qTenantId) {
        const found = DEFAULT_TENANTS.find((t) => t.tenant_id === qTenantId);
        if (found) setCurrentTenant(found);
      }
    }

    // Load registered tenants live from Supabase via Ingest API
    apiFetch("/api/tenants")
      .then((r) => r.json())
      .then((data) => {
        if (data.tenants && data.tenants.length > 0) {
          const mapped: TenantProfile[] = data.tenants.map((t: any) => ({
            tenant_id: t.id,
            tenant_name: t.name,
            name: t.name,
            region: t.region || "ap-south-1",
            collector_id: `00000000-0000-0000-0000-0000000000${t.id.slice(-2)}`,
          }));
          setAvailableTenants(mapped);
        }
      })
      .catch(() => {});

    // Clock ticker
    const clock = setInterval(() => {
      const now = new Date();
      setCurrentTime(now.toUTCString().slice(17, 25) + " UTC");
    }, 1000);

    return () => clearInterval(clock);
  }, []);

  const handleSwitchTenant = (tenantId: string) => {
    const found = availableTenants.find((t) => t.tenant_id === tenantId);
    if (found) {
      setCurrentTenant(found);
      if (typeof window !== "undefined") {
        localStorage.setItem("aiops_current_tenant", JSON.stringify(found));
      }
    }
  };

  return (
    <TenantContext.Provider
      value={{
        currentTenant,
        setCurrentTenant,
        availableTenants,
        handleSwitchTenant,
        fleetState,
        setFleetState,
        secondsAgo,
        setSecondsAgo,
        currentTime,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return context;
}
