"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, CreditCard, LoaderCircle, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { StorePreview } from "@/components/loja-publica/store-preview";
import { ThemePicker } from "@/components/loja-publica/theme-picker";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CLICKCATALOGO_MONTHLY_PLAN } from "@/lib/billing/plan";
import { signupSchema } from "@/lib/signup/schema";
import { formatBrazilWhatsApp, normalizeBrazilWhatsAppInput } from "@/lib/whatsapp/url";
import type { TenantTheme } from "@/types/database";

type FormState = { email: string; nomeLoja: string; privacyAccepted: boolean; slug: string; tema: TenantTheme; termsAccepted: boolean; whatsapp: string };
type SlugStatus = { available: boolean | null; checking: boolean; message: string };

const initialState: FormState = { email: "", nomeLoja: "", privacyAccepted: false, slug: "", tema: "natural", termsAccepted: false, whatsapp: "" };

function slugify(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

export function SignupForm() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugStatus, setSlugStatus] = useState<SlugStatus>({ available: null, checking: false, message: "" });
  const [accountAction, setAccountAction] = useState<"login" | "resume" | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (form.slug.length < 3) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/slug-disponivel?slug=${encodeURIComponent(form.slug)}`, { signal: controller.signal });
        const result = await response.json() as { available: boolean | null; message: string };
        setSlugStatus({ available: result.available, checking: false, message: result.message });
      } catch (fetchError) {
        if ((fetchError as Error).name !== "AbortError") setSlugStatus({ available: null, checking: false, message: "Não foi possível consultar agora." });
      }
    }, 450);
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [form.slug]);

  const preview = useMemo(() => ({ banner_url: null, categorias: [{ id: "11111111-1111-4111-8111-111111111111", nome: "Destaques", ordem: 0, produtos: [{ descricao: "Seu produto com descrição e preço.", id: "22222222-2222-4222-8222-222222222222", imagem_url: null, nome: "Produto de exemplo", ordem: 0, preco: 27, variacao_info: "Variações sob consulta" }] }], descricao_curta: "Catálogo pronto para receber pedidos.", endereco: null, instagram: null, logo_url: null, nome_loja: form.nomeLoja || "Nome da sua loja", slug: form.slug || "sua-loja", status: "ativo" as const, tema: form.tema, whatsapp: form.whatsapp || "5511999999999" }), [form]);
  const effectiveSlugStatus = form.slug.length < 3
    ? { available: false, checking: false, message: slugTouched || form.slug.length > 0 ? "Use pelo menos 3 caracteres." : "" }
    : slugStatus;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((current) => ({ ...current, [key]: value })); }

  function updateSlug(value: string, markAsEdited: boolean) {
    const slug = slugify(value);
    if (markAsEdited) setSlugEdited(true);
    update("slug", slug);
    setSlugStatus(slug.length >= 3
      ? { available: null, checking: true, message: "Verificando endereço..." }
      : { available: null, checking: false, message: "" });
  }

  async function nextStep(event: React.FormEvent) {
    event.preventDefault();
    const validation = signupSchema.pick({ email: true, nomeLoja: true, privacyAccepted: true, slug: true, termsAccepted: true, whatsapp: true }).safeParse(form);
    if (!validation.success) return setError(validation.error.issues[0]?.message ?? "Revise os dados.");
    if (effectiveSlugStatus.available !== true || effectiveSlugStatus.checking) return setError("Aguarde a confirmação de que o endereço está disponível.");
    setCheckingAccount(true); setAccountAction(null); setError(null);
    try {
      const response = await fetch("/api/cadastro/validar-conta", {
        body: JSON.stringify({ email: form.email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json() as { action?: "login" | "resume"; error?: string };
      if (!response.ok) {
        setAccountAction(result.action ?? null);
        return setError(result.error ?? "Não foi possível validar a conta agora.");
      }
      setStep(2); window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Não foi possível validar a conta agora. Confira sua conexão e tente novamente.");
    } finally {
      setCheckingAccount(false);
    }
  }

  async function checkout() {
    const validation = signupSchema.safeParse(form);
    if (!validation.success) return setError(validation.error.issues[0]?.message ?? "Revise os dados.");
    setSubmitting(true); setError(null);
    try {
      const response = await fetch("/api/checkout/asaas", { body: JSON.stringify(form), headers: { "Content-Type": "application/json" }, method: "POST" });
      const result = await response.json() as { checkoutUrl?: string; error?: string };
      if (!response.ok || !result.checkoutUrl) throw new Error(result.error ?? "Não foi possível abrir o checkout.");
      window.location.assign(result.checkoutUrl);
    } catch (checkoutError) { setError(checkoutError instanceof Error ? checkoutError.message : "Não foi possível continuar."); setSubmitting(false); }
  }

  return (
    <div className="grid gap-7">
      <div className="mx-auto flex w-full max-w-xl items-center gap-3"><StepBadge active number="1" title="Dados" /><div className="h-px flex-1 bg-[var(--app-border)]" /><StepBadge active={step === 2} number="2" title="Tema" /></div>
      {step === 1 ? (
        <Card className="mx-auto w-full max-w-xl p-5 sm:p-7">
          <form className="grid gap-5" onSubmit={nextStep}>
            <div><h1 className="text-2xl font-bold">Vamos criar sua loja</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Preencha os dados que seus clientes usarão para encontrar e pedir.</p></div>
            {error ? <div className="grid gap-3"><Alert title={error} variant="danger" />{accountAction ? <div className="flex flex-col gap-2 sm:flex-row">{accountAction === "login" ? <><Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white" href="/painel">Entrar no painel</Link><Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--app-border)] bg-white px-4 text-sm font-semibold" href="/painel/recuperar-senha">Recuperar senha</Link></> : <Link className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] bg-brand-700 px-4 text-sm font-semibold text-white" href="/cadastro/continuar">Continuar cadastro</Link>}</div> : null}</div> : null}
            <Field><FieldLabel htmlFor="nomeLoja">Nome da loja</FieldLabel><Input id="nomeLoja" maxLength={100} onChange={(event) => { update("nomeLoja", event.target.value); if (!slugEdited) updateSlug(event.target.value, false); }} placeholder="Ex.: Sabor da Vila" required value={form.nomeLoja} /></Field>
            <div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel htmlFor="whatsapp">WhatsApp</FieldLabel><Input autoComplete="tel" id="whatsapp" inputMode="tel" maxLength={19} onChange={(event) => update("whatsapp", normalizeBrazilWhatsAppInput(event.target.value))} placeholder="+55 (11) 99999-9999" required type="tel" value={formatBrazilWhatsApp(form.whatsapp)} /><FieldDescription>Código do país + DDD + número. Salvamos apenas os dígitos.</FieldDescription></Field><Field><FieldLabel htmlFor="email">E-mail</FieldLabel><Input autoComplete="email" id="email" maxLength={254} onChange={(event) => { update("email", event.target.value); setAccountAction(null); }} placeholder="voce@empresa.com" required type="email" value={form.email} /><FieldDescription>Este será seu acesso ao painel.</FieldDescription></Field></div>
            <Field><FieldLabel htmlFor="slug">Endereço da loja</FieldLabel><div className="flex rounded-[var(--radius-control)] border bg-white focus-within:border-brand-600 focus-within:shadow-[var(--focus-ring)]"><span className="flex items-center border-r px-3 text-xs text-[var(--app-foreground-muted)]">/loja/</span><input aria-describedby="slug-status" aria-invalid={effectiveSlugStatus.available === false && slugTouched} className="h-11 min-w-0 flex-1 bg-transparent px-3 text-sm outline-none" id="slug" maxLength={60} onBlur={() => setSlugTouched(true)} onChange={(event) => updateSlug(event.target.value, true)} required value={form.slug} /></div><p aria-live="polite" className={`min-h-4 text-xs ${effectiveSlugStatus.available === true ? "text-[var(--app-success)]" : effectiveSlugStatus.available === false ? "text-[var(--app-danger)]" : "text-[var(--app-foreground-muted)]"}`} id="slug-status">{effectiveSlugStatus.checking ? <LoaderCircle aria-hidden="true" className="mr-1 inline size-3 animate-spin" /> : effectiveSlugStatus.available === true ? <CheckCircle2 aria-hidden="true" className="mr-1 inline size-3" /> : null}{effectiveSlugStatus.message}</p></Field>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input checked={form.termsAccepted} className="mt-1 size-4 accent-[var(--brand-700)]" onChange={(event) => update("termsAccepted", event.target.checked)} type="checkbox" /><span>Li e aceito os <Link className="-my-2 inline-flex min-h-11 items-center font-semibold text-brand-700 underline" href="/termos" rel="noreferrer" target="_blank">termos de uso</Link>.</span></label>
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6"><input checked={form.privacyAccepted} className="mt-1 size-4 accent-[var(--brand-700)]" onChange={(event) => update("privacyAccepted", event.target.checked)} type="checkbox" /><span>Li e aceito a <Link className="-my-2 inline-flex min-h-11 items-center font-semibold text-brand-700 underline" href="/privacidade" rel="noreferrer" target="_blank">política de privacidade</Link>.</span></label>
            <Button disabled={checkingAccount} size="lg" type="submit">{checkingAccount ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}{checkingAccount ? "Validando seus dados..." : "Escolher o tema"}{!checkingAccount ? <ArrowRight aria-hidden="true" /> : null}</Button>
          </form>
        </Card>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[0.75fr_1.25fr]">
          <Card className="p-5 sm:p-6"><h1 className="text-2xl font-bold">Escolha a cara da loja</h1><p className="mt-2 text-sm leading-6 text-[var(--app-foreground-muted)]">Você poderá trocar o tema pelo painel a qualquer momento.</p>{error ? <Alert className="mt-5" title={error} variant="danger" /> : null}<div className="mt-6"><ThemePicker onValueChange={(tema) => update("tema", tema)} value={form.tema} /></div><div className="mt-6 rounded-lg bg-brand-50 p-4"><p className="text-sm font-semibold">{CLICKCATALOGO_MONTHLY_PLAN.name}</p><p className="mt-1 text-2xl font-bold">R$ {CLICKCATALOGO_MONTHLY_PLAN.value} <span className="text-sm font-normal text-[var(--app-foreground-muted)]">/ mês</span></p><p className="mt-3 flex items-center gap-2 border-t border-brand-200 pt-3 text-sm font-medium text-brand-800"><CreditCard aria-hidden="true" className="size-4 shrink-0" />Pagamento mensal no cartão de crédito</p><p className="mt-1 text-xs leading-5 text-[var(--app-foreground-muted)]">Cobrança processada com segurança pelo Asaas.</p></div><div className="mt-5 grid gap-2"><Button disabled={submitting} onClick={checkout} size="lg">{submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <LockKeyhole aria-hidden="true" />}{submitting ? "Abrindo checkout..." : "Continuar para pagamento"}</Button><Button disabled={submitting} onClick={() => setStep(1)} variant="ghost"><ArrowLeft aria-hidden="true" />Voltar e revisar</Button></div></Card>
          <div className="lg:sticky lg:top-4"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Sua loja ao vivo</p><StorePreview catalog={preview} framed theme={form.tema} /></div>
        </div>
      )}
    </div>
  );
}

function StepBadge({ active, number, title }: { active: boolean; number: string; title: string }) { return <div className={`flex items-center gap-2 text-sm font-semibold ${active ? "text-brand-700" : "text-[var(--app-foreground-muted)]"}`}><span className={`grid size-7 place-items-center rounded-full ${active ? "bg-brand-700 text-white" : "bg-[var(--app-surface-muted)]"}`}>{number}</span>{title}</div>; }
