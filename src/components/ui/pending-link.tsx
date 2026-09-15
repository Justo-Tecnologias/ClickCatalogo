"use client";

import { LoaderCircle } from "lucide-react";
import Link, { useLinkStatus } from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils/cn";

type PendingLinkProps = Omit<ComponentProps<typeof Link>, "children"> & {
  children: ReactNode;
  pendingLabel?: string;
};

function PendingContent({ children, pendingLabel }: Pick<PendingLinkProps, "children" | "pendingLabel">) {
  const { pending } = useLinkStatus();

  return (
    <>
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" data-pending="true" /> : null}
      {pending && pendingLabel ? pendingLabel : children}
      <span aria-live="polite" className="sr-only" role="status">
        {pending ? "Carregando página" : ""}
      </span>
    </>
  );
}

export function PendingLink({ children, className, pendingLabel, ...props }: PendingLinkProps) {
  return (
    <Link
      className={cn(
        "has-[[data-pending=true]]:pointer-events-none has-[[data-pending=true]]:cursor-wait",
        className,
      )}
      {...props}
    >
      <PendingContent pendingLabel={pendingLabel}>{children}</PendingContent>
    </Link>
  );
}
