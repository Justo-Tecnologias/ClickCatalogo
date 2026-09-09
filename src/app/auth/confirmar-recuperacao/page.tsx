import { KeyRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { RecoveryLinkConfirmation } from "@/components/painel/recovery-link-confirmation";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Confirmar recuperação",
};

export default function ConfirmRecoveryPage() {
  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-12">
      <div className="absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-brand-100 to-transparent" />
      <div className="relative w-full max-w-md">
        <Card className="overflow-hidden">
          <div className="h-1.5 bg-brand-700" />
          <CardHeader>
            <span className="mb-3 grid size-11 place-items-center rounded-xl bg-brand-100 text-brand-700">
              <KeyRound aria-hidden="true" className="size-5" />
            </span>
            <CardTitle as="h1" className="text-2xl">Confirme a recuperação</CardTitle>
            <CardDescription>Este passo protege seu link antes de abrir a criação de uma nova senha.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <RecoveryLinkConfirmation />
            <Link
              className={buttonVariants({ className: "w-full", variant: "ghost" })}
              href="/painel/recuperar-senha"
            >
              Solicitar outro link
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
