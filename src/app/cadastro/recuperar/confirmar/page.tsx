import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SignupRecoveryConfirmation } from "@/components/cadastro/signup-recovery-confirmation";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Validar recuperação",
};

export default function SignupRecoveryConfirmationPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,var(--brand-100),var(--app-background)_45%)] px-4 py-10 sm:py-16">
      <div className="mx-auto w-full max-w-xl">
        <Link className="mb-7 flex min-h-11 items-center justify-center gap-2 font-bold" href="/">
          <span className="grid size-8 place-items-center rounded-lg bg-brand-900 text-white"><ShoppingBag aria-hidden="true" className="size-4" /></span>
          ClickCatálogo
        </Link>
        <Card className="p-6 sm:p-8"><SignupRecoveryConfirmation /></Card>
      </div>
    </main>
  );
}
