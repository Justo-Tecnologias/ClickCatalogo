import { ArrowRight } from "lucide-react";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { AcquisitionOrigin } from "@/lib/analytics/origins";
import { SHOWCASE_NICHE_IDS, SHOWCASE_NICHES, type ShowcaseNiche } from "@/lib/marketing/store-showcase";
import { cn } from "@/lib/utils/cn";

// Formulário GET para /exemplo: funciona mesmo antes do JavaScript carregar e
// não envia nada ao servidor além da URL da prévia.
export function ShowcaseForm({
  className,
  defaultName = "",
  defaultNiche = "doces",
  origin,
}: {
  className?: string;
  defaultName?: string;
  defaultNiche?: ShowcaseNiche;
  origin?: AcquisitionOrigin | null;
}) {
  return (
    <form action="/exemplo" className={cn("grid gap-5", className)} method="get">
      {origin ? <input name="origem" type="hidden" value={origin} /> : null}
      <div className="grid gap-2">
        <FieldLabel htmlFor="showcase-nome">Nome do seu negócio</FieldLabel>
        <Input
          autoComplete="organization"
          defaultValue={defaultName}
          id="showcase-nome"
          maxLength={60}
          minLength={2}
          name="nome"
          placeholder="Ex.: Doces da Ana"
          required
        />
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-semibold text-[var(--app-foreground)]">O que você vende?</legend>
        <FieldDescription>Não achou o seu? Escolha o mais parecido.</FieldDescription>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {SHOWCASE_NICHE_IDS.map((id) => {
            const niche = SHOWCASE_NICHES[id];
            return (
              <label
                className="group flex min-h-14 cursor-pointer items-center gap-2.5 rounded-[var(--radius-card)] border border-[var(--app-border)] bg-white p-2 text-sm font-medium transition hover:border-brand-300 has-[:checked]:border-brand-700 has-[:checked]:bg-brand-50 has-[:checked]:ring-2 has-[:checked]:ring-brand-700/20 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-brand-700/30"
                key={id}
              >
                <input className="sr-only" defaultChecked={id === defaultNiche} name="nicho" type="radio" value={id} />
                <Image
                  alt=""
                  className="size-10 shrink-0 rounded-lg object-cover"
                  height={80}
                  src={niche.categorias[0].produtos[0].imagem}
                  width={80}
                />
                <span className="leading-tight">{niche.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <Button className="w-full sm:w-auto sm:justify-self-start" size="lg" type="submit">
        Ver minha loja
        <ArrowRight aria-hidden="true" />
      </Button>
    </form>
  );
}
