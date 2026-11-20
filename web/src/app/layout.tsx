import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AIOps // Privacy-Preserving Observability & Autonomous Remediation",
  description: "Cryptographically verified, zero-leak observability platform with Google Gemini 3.5 Flash root cause analysis and human-in-the-loop autonomous remediation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="min-h-full bg-[#07090C] text-white antialiased flex flex-col selection:bg-[#C8F63B] selection:text-[#07090C]">
        {children}
      </body>
    </html>
  );
}
