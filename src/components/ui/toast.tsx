"use client";

import { CheckCircle2, Info, TriangleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

type ToastVariant = "danger" | "info" | "success";
type ToastInput = { description?: string; title: string; variant?: ToastVariant };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const styles: Record<ToastVariant, string> = {
  danger: "border-red-200 bg-red-50 text-red-950",
  info: "border-blue-200 bg-blue-50 text-blue-950",
  success: "border-emerald-200 bg-emerald-50 text-emerald-950",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, number>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((input: ToastInput) => {
    const id = ++nextId.current;
    setToasts((current) => [...current.slice(-2), { ...input, id }]);
    timers.current.set(id, window.setTimeout(() => dismiss(id), input.variant === "danger" ? 7000 : 4500));
  }, [dismiss]);

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
  }, []);

  return (
    <ToastContext value={notify}>
      {children}
      <div
        aria-label="Notificações"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-[70] grid gap-2 sm:inset-x-auto sm:right-5 sm:top-5 sm:bottom-auto sm:w-full sm:max-w-sm"
      >
        {toasts.map((toast) => {
          const variant = toast.variant ?? "info";
          const Icon = variant === "success" ? CheckCircle2 : variant === "danger" ? TriangleAlert : Info;
          return (
            <div
              className={`pointer-events-auto flex items-start gap-3 rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-elevation)] ${styles[variant]}`}
              key={toast.id}
              role={variant === "danger" ? "alert" : "status"}
            >
              <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{toast.title}</p>
                {toast.description ? <p className="mt-1 text-sm leading-5 opacity-80">{toast.description}</p> : null}
              </div>
              <Button aria-label="Fechar notificação" className="-m-2 shrink-0" onClick={() => dismiss(toast.id)} size="icon" variant="ghost">
                <X aria-hidden="true" />
              </Button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast deve ser usado dentro de ToastProvider.");
  return notify;
}
