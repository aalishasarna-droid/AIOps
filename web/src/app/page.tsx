"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data && e.data.type === "NAVIGATE" && typeof e.data.url === "string") {
        router.push(e.data.url);
      }
    };
    window.addEventListener("message", handleMsg);
    return () => window.removeEventListener("message", handleMsg);
  }, [router]);

  return (
    <main className="fixed inset-0 w-screen h-screen m-0 p-0 overflow-hidden bg-[#04060f] z-50">
      <iframe
        src="/index.html?v=subtle-atmosphere"
        className="w-full h-full border-0 m-0 p-0 block"
        title="AIOps Guardian — Private at edge, unified visibility"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </main>
  );
}
