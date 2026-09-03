"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Input } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await apiFetch("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Unable to sign in. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseDemo = () => {
    setEmail("demo@brightdental.com");
    setPassword("password123");
  };

  return (
    <div>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white">Sign In to Your Workspace</h3>
        <p className="text-xs text-slate-400 mt-1">
          Enter your credentials to access your AI receptionist dashboard.
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
          label="Work Email"
          placeholder="name@business.com"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="password" className="text-xs font-semibold text-slate-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" isLoading={isLoading}>
          Sign In
        </Button>
      </form>

      <div className="mt-4 pt-4 border-t border-slate-800 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleUseDemo}
          className="w-full py-1.5 px-3 rounded-lg bg-indigo-950/40 border border-indigo-800/40 text-[11px] font-medium text-indigo-300 hover:bg-indigo-900/50 transition"
        >
          🔑 Fill Demo: demo@brightdental.com (Bright Dental)
        </button>

        <p className="text-center text-xs text-slate-400 mt-1">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
