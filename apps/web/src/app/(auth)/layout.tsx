import React from "react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-lg shadow-indigo-500/20 text-sm">
          R
        </div>
        <h2 className="mt-3 text-xl font-bold tracking-tight text-white">ReceptionAI</h2>
        <p className="mt-1 text-xs text-slate-400">Production AI Voice Receptionist Platform</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-[#0c121e] py-8 px-6 shadow-xl border border-slate-800 rounded-2xl sm:px-10">
          {children}
        </div>
      </div>
    </div>
  );
}
