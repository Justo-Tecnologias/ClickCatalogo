import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export function Input({ className, type = "text", ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-[var(--radius-control)] border bg-white px-3 text-base text-[var(--app-foreground)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--app-foreground-muted)]/70 hover:border-neutral-400 focus:border-brand-600 focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:opacity-70 aria-invalid:border-[var(--app-danger)] aria-invalid:shadow-[0_0_0_3px_rgb(180_35_24_/_12%)] sm:text-sm",
        className,
      )}
      type={type}
      {...props}
    />
  );
}
