import type { ComponentProps } from "react";

import { cn } from "@/lib/utils/cn";

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-[var(--radius-control)] border bg-white px-3 py-2.5 text-base leading-6 text-[var(--app-foreground)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--app-foreground-muted)]/70 hover:border-neutral-400 focus:border-brand-600 focus:shadow-[var(--focus-ring)] disabled:cursor-not-allowed disabled:bg-[var(--app-surface-muted)] disabled:opacity-70 aria-invalid:border-[var(--app-danger)] sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}
