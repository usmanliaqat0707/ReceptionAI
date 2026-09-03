import React from "react";
import { Badge, Button } from "@receptionai/ui";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  actionText?: string;
  actionDisabled?: boolean;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  badge = "Coming in Phase 2",
  actionText,
  actionDisabled = true,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-800/80 text-slate-400 border border-slate-700">
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {badge && <Badge variant="purple">{badge}</Badge>}
      </div>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-slate-400">{description}</p>
      {actionText && (
        <div className="mt-6">
          <Button variant="secondary" size="sm" disabled={actionDisabled}>
            {actionText}
          </Button>
        </div>
      )}
    </div>
  );
}
