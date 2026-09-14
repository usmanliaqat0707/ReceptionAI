"use client";

import React, { useEffect } from "react";
import { AlertTriangle, AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export interface ThemedDialogProps {
  isOpen: boolean;
  type?: "confirm" | "alert" | "error" | "success";
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ThemedDialog({
  isOpen,
  type = "alert",
  title,
  description,
  confirmText,
  cancelText = "Cancel",
  confirmVariant,
  loading = false,
  onConfirm,
  onCancel,
}: ThemedDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !loading) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, loading, onCancel]);

  if (!isOpen) return null;

  const isConfirm = type === "confirm";
  const defaultConfirmText = isConfirm ? "Confirm" : "OK";
  const resolvedConfirmText = confirmText || defaultConfirmText;
  const isDanger = confirmVariant === "danger" || (isConfirm && !confirmVariant);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
        {/* Close Button */}
        {!loading && (
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Icon & Title */}
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl border flex-shrink-0 ${
              type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                : type === "confirm"
                  ? isDanger
                    ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
                    : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                  : type === "success"
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
            }`}
          >
            {type === "error" && <AlertCircle className="w-5 h-5" />}
            {type === "confirm" && <AlertTriangle className="w-5 h-5" />}
            {type === "success" && <CheckCircle2 className="w-5 h-5" />}
            {type === "alert" && <Info className="w-5 h-5" />}
          </div>

          <div className="space-y-1 pr-4">
            <h3 className="text-sm font-semibold text-white tracking-tight">{title}</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{description}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
          {isConfirm && (
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              {cancelText}
            </button>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-5 py-2 text-white rounded-xl text-xs font-semibold shadow-md transition-all ${
              isDanger && isConfirm
                ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/20"
                : type === "success"
                  ? "bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20"
                  : "bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20"
            } disabled:opacity-50`}
          >
            {loading && (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span>{resolvedConfirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
