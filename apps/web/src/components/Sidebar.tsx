"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Users,
  Target,
  Calendar,
  BookOpen,
  Boxes,
  BarChart3,
  Settings,
  LogOut,
  ChevronDown,
  Building2,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface Workspace {
  id: string;
  name: string;
  slug: string;
  role: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [showWorkspaceMenu, setShowWorkspaceMenu] = useState(false);

  useEffect(() => {
    // Fetch current user and workspaces
    apiFetch<{ user: User; memberships: Array<{ role: string; workspace: Workspace }> }>(
      "/api/v1/auth/me"
    )
      .then((data) => {
        setUser(data.user);
        const wsList = data.memberships.map((m) => ({
          ...m.workspace,
          role: m.role,
        }));
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          const storedSlug = localStorage.getItem("rai_active_ws");
          const selected = wsList.find((w) => w.slug === storedSlug) || wsList[0];
          setActiveWorkspace(selected);
        }
      })
      .catch(() => {
        // Unauthenticated -> redirect to login
        if (!pathname.startsWith("/login") && !pathname.startsWith("/signup")) {
          router.push("/login");
        }
      });
  }, [pathname, router]);

  const handleSwitchWorkspace = (ws: Workspace) => {
    setActiveWorkspace(ws);
    localStorage.setItem("rai_active_ws", ws.slug);
    setShowWorkspaceMenu(false);
  };

  const handleLogout = async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
    }
  };

  const navItems = [
    { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
    { label: "AI Receptionists", href: "/receptionists", icon: Bot },
    { label: "Calls", href: "/calls", icon: PhoneCall },
    { label: "Contacts", href: "/contacts", icon: Users },
    { label: "Leads", href: "/leads", icon: Target },
    { label: "Appointments", href: "/appointments", icon: Calendar },
    { label: "Knowledge Base", href: "/knowledge", icon: BookOpen },
    { label: "Integrations", href: "/integrations", icon: Boxes },
    { label: "Analytics", href: "/analytics", icon: BarChart3 },
    { label: "Settings", href: "/settings/workspace", icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 bg-[#0c121e] flex flex-col justify-between h-screen fixed top-0 left-0 z-30">
      <div>
        {/* Brand Header */}
        <div className="h-14 border-b border-slate-800/80 px-4 flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow">
            R
          </div>
          <div>
            <span className="font-semibold text-sm text-white tracking-tight">ReceptionAI</span>
            <span className="ml-1.5 text-[9px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-800/50 px-1 py-0.5 rounded">
              Phase 1
            </span>
          </div>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3">
          <div className="relative">
            <button
              onClick={() => setShowWorkspaceMenu(!showWorkspaceMenu)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-left transition"
            >
              <div className="flex items-center gap-2 overflow-hidden">
                <Building2 className="h-4 w-4 text-slate-400 shrink-0" />
                <div className="truncate">
                  <p className="text-xs font-medium text-white truncate">
                    {activeWorkspace?.name || "Loading workspace..."}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                    {activeWorkspace?.role || "Staff"}
                  </p>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            </button>

            {showWorkspaceMenu && (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-lg bg-slate-900 border border-slate-800 py-1 shadow-xl z-50">
                <div className="px-3 py-1 text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Your Workspaces
                </div>
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => handleSwitchWorkspace(ws)}
                    className="w-full text-left px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 hover:text-white flex items-center justify-between"
                  >
                    <span className="truncate">{ws.name}</span>
                    <span className="text-[10px] text-slate-500 uppercase">{ws.role}</span>
                  </button>
                ))}
                <div className="border-t border-slate-800 mt-1 pt-1">
                  <Link
                    href="/onboarding"
                    onClick={() => setShowWorkspaceMenu(false)}
                    className="block px-3 py-1.5 text-xs text-indigo-400 hover:bg-slate-800 font-medium"
                  >
                    + Create New Workspace
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="px-3 space-y-0.5 mt-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href) ||
                  (item.href === "/settings/workspace" && pathname.startsWith("/settings"));
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? "bg-indigo-600/10 text-indigo-400 font-semibold border border-indigo-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-indigo-400" : "text-slate-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-slate-900/50">
          <div className="flex items-center gap-2 overflow-hidden">
            <div className="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-semibold text-slate-200 shrink-0">
              {user?.name ? user.name[0]?.toUpperCase() : "U"}
            </div>
            <div className="truncate">
              <p className="text-xs font-medium text-white truncate">{user?.name || "User"}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
