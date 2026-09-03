"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button, Input } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invitationToken = searchParams.get("invitation");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch("/api/v1/auth/signup", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });

      // If user joined via workspace invitation
      if (invitationToken) {
        await apiFetch(`/api/v1/invitations/${invitationToken}/accept`, {
          method: "POST",
        }).catch(() => {});
        router.push("/dashboard");
        return;
      }

      // Fresh user -> Onboarding to create first workspace
      router.push("/onboarding");
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Unable to create account. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Create Your Account</h3>
        <p className="text-xs text-slate-400 mt-1">
          {invitationToken
            ? "Sign up to accept your workspace invitation."
            : "Get started with your multi-tenant ReceptionAI workspace."}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="name"
          type="text"
          label="Full Name"
          placeholder="e.g. Dr. Alex Mercer"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <Input
          id="email"
          type="email"
          label="Work Email"
          placeholder="alex@example.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <Input
          id="password"
          type="password"
          label="Password (min 8 characters)"
          placeholder="••••••••"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Create Account
        </Button>
      </form>

      <div className="mt-6 pt-4 border-t border-slate-800 text-center">
        <p className="text-xs text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="text-xs text-slate-400">Loading signup...</div>}>
      <SignupForm />
    </Suspense>
  );
}
