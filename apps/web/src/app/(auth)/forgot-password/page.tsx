"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch("/api/v1/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Unable to process request.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center">
        <div className="h-10 w-10 mx-auto rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold mb-3">
          ✓
        </div>
        <h3 className="text-base font-semibold text-white">Reset Link Sent</h3>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          If an account exists for <span className="text-white font-medium">{email}</span>, we have
          sent instructions to reset your password.
        </p>
        <div className="mt-6">
          <Link href="/login">
            <Button variant="secondary" size="sm" className="w-full">
              Back to Sign In
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Reset Your Password</h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter your registered email address to receive a secure password reset link.
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="email"
          type="email"
          label="Registered Email"
          placeholder="name@business.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Send Reset Instructions
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-800 text-center">
        <Link href="/login" className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">
          ← Back to Sign In
        </Link>
      </div>
    </div>
  );
}
