import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReceptionAI — AI Voice Receptionist SaaS",
  description: "Production-grade multi-tenant AI Voice Receptionist SaaS platform.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#090d16] text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
