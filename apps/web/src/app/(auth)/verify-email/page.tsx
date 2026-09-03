"use client";

import React, { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@receptionai/ui";
import { apiFetch } from "@/lib/api";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      return;
    }

    apiFetch("/api/v1/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(() => setStatus("success"))
      .catch(() => setStatus("error"));
  }, [token]);

  if (status === "verifying") {
    return (
      <div className="text-center py-6">
        <p className="text-xs text-slate-400">Verifying your email token...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="text-center">
        <div className="h-10 w-10 mx-auto rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold mb-3">
          ✕
        </div>
        <h3 className="text-base font-semibold text-white">Verification Failed</h3>
        <p className="mt-2 text-xs text-slate-400">
          This verification link is invalid, expired, or has already been used.
        </p>
        <div className="mt-6">
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Return to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="text-center">
      <div className="h-10 w-10 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold mb-3">
        ✓
      </div>
      <h3 className="text-base font-semibold text-white">Email Verified</h3>
      <p className="mt-2 text-xs text-slate-400">
        Your email address has been verified successfully.
      </p>
      <div className="mt-6">
        <Link href="/dashboard">
          <Button size="sm">Continue to Dashboard</Button>
        </Link>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Loading...</div>}>
      <VerifyEmailContent />
    </Suspense>
  );
}
