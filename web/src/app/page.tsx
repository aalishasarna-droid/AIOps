"use client";

import React from "react";

export default function LandingPage() {
  return (
    <main className="fixed inset-0 w-screen h-screen m-0 p-0 overflow-hidden bg-[#04060f] z-50">
      <iframe
        src="/index.html"
        className="w-full h-full border-0 m-0 p-0 block"
        title="Ascend — Scale Smarter, Not Harder"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      />
    </main>
  );
}
