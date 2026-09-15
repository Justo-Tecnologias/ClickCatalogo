"use client";

import { CheckCircle2, Link2, LoaderCircle, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { updateStoreSlugAction } from "@/app/painel/(app)/loja/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { tenantSlugSchema } from "@/lib/tenants/slug";

type Availability = { message: string; state: "checking" | "invalid" | "available" | "unavailable" | "unknown" };

function normalizeSlugInput(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function StoreSlugForm({ currentSlug: initialSlug, demo = false, siteUrl }: { currentSlug: string; demo?: boolean; siteUrl: string }) {
  const [currentSlug, setCurrentSlug] = useState(initialSlug);
  const [slug, setSlug] = useState(initialSlug);
  const [availability, setAvailability] = useState<Availability>({ message: "Este é o endereço atual da sua loja.", state: "unknown" });
  const [isPending, startTransition] = useTransition();
  const notify = useToast();
  const router = useRouter();
  const baseUrl = useMemo(() => siteUrl.replace(/\/$/, ""), [siteUrl]);
  const changed = slug !== currentSlug;

  useEffect(() => {
    if (!changed) return;
    const parsed = tenantSlugSchema.safeParse(slug);
    if (!parsed.success) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setAvailability({ message: "Verificando disponibilidade...", state: "checking" });
      try {
        const response = await fetch(`/api/slug-disponivel?slug=${encodeURIComponent(parsed.data)}`, { signal: controller.signal });
        const result = await response.json() as { available: boolean | null; message?: string };
        if (!response.ok || result.available === null) {
          setAvailability({ message: result.message ?? "Não foi possível verificar agora.", state: "unknown" });
          return;
        }
        setAvailability({
          message: result.message ?? (result.available ? "Endereço disponível!" : "Este endereço já está em uso."),
          state: result.available ? "available" : "unavailable",
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setAvailability({ message: "Não foi possível verificar agora.", state: "unknown" });
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [changed, slug]);

  function changeValue(value: string) {
    const normalized = normalizeSlugInput(value);
    setSlug(normalized);
    if (normalized === currentSlug) {
      setAvailability({ message: "Este é o endereço atual da sua loja.", state: "unknown" });
      return;
    }
    const parsed = tenantSlugSchema.safeParse(normalized);
    if (!parsed.success) setAvailability({ message: parsed.error.issues[0]?.message ?? "Endereço inválido.", state: "invalid" });
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed || availability.state !== "available") return;
    startTransition(async () => {
      const result = await updateStoreSlugAction({ slug });
      if (!result.ok) {
        setAvailability({ message: result.error, state: "unavailable" });
        notify({ title: result.error, variant: "danger" });
        return;
      }
      if (!result.data) {
        notify({ title: "Não foi possível confirmar o novo endereço.", variant: "danger" });
        return;
      }
      setCurrentSlug(result.data.newSlug);
      setSlug(result.data.newSlug);
      setAvailability({ message: "Novo endereço publicado.", state: "available" });
      notify({
        description: "O endereço anterior redirecionará os clientes por 30 dias.",
        title: "Endereço da loja alterado",
        variant: "success",
      });
      router.refresh();
    });
  }

  const statusIcon = availability.state === "checking"
    ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
    : availability.state === "available"
      ? <CheckCircle2 aria-hidden="true" className="size-4 text-emerald-700" />
      : availability.state === "invalid" || availability.state === "unavailable"
        ? <TriangleAlert aria-hidden="true" className="size-4 text-red-700" />
        : null;

  return (
    <Card className="grid gap-5 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700"><Link2 aria-hidden="true" className="size-5" /></span>
        <div><h2 className="text-lg font-bold">Endereço da loja</h2><p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">Escolha o link curto que você compartilha com seus clientes.</p></div>
      </div>

      {demo ? <Alert title="Na demonstração, o endereço é somente para visualização." variant="info" /> : null}

      <form className="grid gap-4" onSubmit={submit}>
        <Field>
          <FieldLabel htmlFor="store-slug">Link público</FieldLabel>
          <div className="flex min-w-0 items-center rounded-[var(--radius-control)] border bg-white focus-within:border-brand-600 focus-within:shadow-[var(--focus-ring)]">
            <span className="hidden min-w-0 truncate pl-3 text-sm text-[var(--app-foreground-muted)] sm:block">{baseUrl}/loja/</span>
            <span className="shrink-0 pl-3 text-sm text-[var(--app-foreground-muted)] sm:hidden">/loja/</span>
            <Input aria-describedby="store-slug-status" className="min-w-0 flex-1 border-0 bg-transparent pl-0 focus:border-0 focus:shadow-none" disabled={demo || isPending} id="store-slug" maxLength={60} onChange={(event) => changeValue(event.target.value)} spellCheck={false} value={slug} />
          </div>
          <div aria-live="polite" className="flex items-center gap-2 text-xs leading-5" id="store-slug-status">{statusIcon}<span className={availability.state === "invalid" || availability.state === "unavailable" ? "text-red-800" : "text-[var(--app-foreground-muted)]"}>{availability.message}</span></div>
          {availability.state === "invalid" ? <FieldError>Corrija o endereço antes de salvar.</FieldError> : null}
          <FieldDescription>Ao trocar, o link anterior continuará levando à sua loja por 30 dias. Para evitar reservas excessivas, até três links antigos podem ficar protegidos ao mesmo tempo.</FieldDescription>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button disabled={demo || isPending || !changed || availability.state !== "available"} type="submit">{isPending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Link2 aria-hidden="true" />}{isPending ? "Alterando..." : "Alterar endereço"}</Button>
          {changed ? <Button disabled={isPending} onClick={() => changeValue(currentSlug)} type="button" variant="secondary">Cancelar</Button> : null}
        </div>
      </form>
    </Card>
  );
}
