"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { PendingLink } from "@/components/ui/pending-link";
import { cn } from "@/lib/utils/cn";

// Botão fixo de cadastro no celular. Aparece depois do hero e some enquanto
// qualquer seção que já tem o próprio botão (hero, chamada final, rodapé)
// estiver visível, para nunca cobrir um CTA ou os links do rodapé.
export function MobileStickyCta({ hideWhenVisible }: { hideWhenVisible: string[] }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const targets = hideWhenVisible
      .map((id) => document.getElementById(id))
      .filter((element): element is HTMLElement => Boolean(element));
    if (targets.length === 0) return;

    const onScreen = new Set<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) onScreen.add(entry.target);
        else onScreen.delete(entry.target);
      }
      setVisible(onScreen.size === 0);
    });
    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, [hideWhenVisible]);

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-brand-900/10 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_32px_rgb(19_50_41_/_12%)] backdrop-blur transition-transform duration-200 sm:hidden",
        visible ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
    >
      <PendingLink
        className={buttonVariants({ className: "w-full", size: "lg" })}
        href="/cadastro"
        pendingLabel="Abrindo cadastro..."
        tabIndex={visible ? undefined : -1}
      >
        Quero minha loja · R$ 27/mês
        <ArrowRight aria-hidden="true" />
      </PendingLink>
    </div>
  );
}
