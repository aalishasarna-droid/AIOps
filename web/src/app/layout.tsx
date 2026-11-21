import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/context/ThemeContext";
import { AudioAlertProvider } from "@/context/AudioAlertContext";

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
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('aiops_theme');
                if (theme === 'light') {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.classList.add('light');
                  document.documentElement.setAttribute('data-theme', 'light');
                } else {
                  document.documentElement.classList.remove('light');
                  document.documentElement.classList.add('dark');
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-[#07090C] text-white antialiased flex flex-col selection:bg-[#C8F63B] selection:text-[#07090C] transition-colors duration-200">
        <ThemeProvider>
          <AudioAlertProvider>
            {children}
          </AudioAlertProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
