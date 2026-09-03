"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Card } from "@receptionai/ui";
import { apiFetch, ApiException } from "@/lib/api";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Paris",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Singapore",
  "Asia/Tokyo",
];

const INDUSTRIES = [
  "Dental Clinic",
  "Medical & Healthcare",
  "Legal Services",
  "Real Estate",
  "Home Services / HVAC",
  "Financial Advisory",
  "Automotive Services",
  "General Business",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("Bright Dental");
  const [industry, setIndustry] = useState("Dental Clinic");
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await apiFetch<{ workspace: { id: string; slug: string } }>(
        "/api/v1/workspaces",
        {
          method: "POST",
          body: JSON.stringify({ name, industry, timezone }),
        }
      );

      localStorage.setItem("rai_active_ws", res.workspace.slug);
      router.push("/dashboard");
    } catch (err) {
      if (err instanceof ApiException) {
        setError(err.error.message);
      } else {
        setError("Unable to create workspace.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white shadow-lg text-sm mb-3">
            R
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">Set Up Your Workspace</h2>
          <p className="text-xs text-slate-400 mt-1">
            Step 2 of 2: Configure your company workspace and operational timezone.
          </p>
        </div>

        <Card className="bg-[#0c121e] border-slate-800 p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="name"
              label="Business / Workspace Name"
              placeholder="e.g. Bright Dental"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div className="space-y-1">
              <label htmlFor="industry" className="block text-xs font-semibold text-slate-300">
                Industry
              </label>
              <select
                id="industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label htmlFor="timezone" className="block text-xs font-semibold text-slate-300">
                Operating Timezone (IANA)
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500">
                Your receptionist will respect this timezone for business hours and bookings.
              </p>
            </div>

            <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
              Complete Setup & Enter Dashboard →
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
