import React from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090d16] flex">
      <Sidebar />
      <div className="pl-64 flex-1 flex flex-col min-w-0">
        <Header />
        <main className="p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
