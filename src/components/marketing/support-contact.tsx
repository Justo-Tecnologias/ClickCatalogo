"use client";

import { CheckCircle2, LoaderCircle, Send } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type SupportTopic = "cobranca" | "dados" | "geral" | "problema" | "sugestao";

const topicContent = {
  cobranca: { label: "Cobrança e assinatura", placeholder: "Conte sua dúvida sobre cobrança ou assinatura." },
  dados: { label: "Privacidade e dados", placeholder: "Explique o que você precisa resolver sobre seus dados." },
  geral: { label: "Dúvida geral", placeholder: "Conte sua dúvida ou explique o que precisa resolver." },
  problema: { label: "Relatar problema", placeholder: "Conte o que aconteceu, o que esperava e em qual tela estava." },
  sugestao: { label: "Sugestão de melhoria", placeholder: "Conte o que poderia ser mais simples ou o que você gostaria de encontrar." },
} as const;

export function SupportContact({
  defaultEmail = "",
  defaultName = "",
  defaultTopic,
  supportEmail,
}: {
  defaultEmail?: string;
  defaultName?: string;
  defaultTopic: SupportTopic;
  supportEmail: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(defaultName);
  const [topic, setTopic] = useState<SupportTopic>(defaultTopic);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ message: string; type: "danger" | "success" } | null>(null);
  const normalizedName = name.trim();
  const normalizedEmail = email.trim();
  const normalizedMessage = message.trim();
  const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  const missingMessageCharacters = Math.max(0, 10 - normalizedMessage.length);
  const formIsValid = normalizedName.length >= 2 && emailIsValid && missingMessageCharacters === 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setResult(null);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/atendimento", {
        body: JSON.stringify({
          email,
          message,
          name,
          pageUrl: window.location.href,
          topic,
          userAgent: window.navigator.userAgent,
          website: formData.get("website") ?? "",
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const data = await response.json() as { error?: string; message?: string };
      if (response.status === 429) {
        const retryAfterSeconds = Number(response.headers.get("Retry-After"));
        const retryAfterMinutes = Number.isFinite(retryAfterSeconds)
          ? Math.max(1, Math.ceil(retryAfterSeconds / 60))
          : null;
        throw new Error(
          retryAfterMinutes
            ? `Você enviou várias mensagens em seguida. Tente novamente em cerca de ${retryAfterMinutes} ${retryAfterMinutes === 1 ? "minuto" : "minutos"}.`
            : "Você enviou várias mensagens em seguida. Aguarde alguns minutos e tente novamente.",
        );
      }
      if (!response.ok) throw new Error(data.error ?? "Não foi possível enviar sua mensagem.");
      setMessage("");
      setResult({ message: data.message ?? "Mensagem enviada com sucesso.", type: "success" });
    } catch (error) {
      setResult({
        message: error instanceof Error ? error.message : "Não foi possível enviar sua mensagem.",
        type: "danger",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {result ? (
        <Alert
          icon={result.type === "success" ? CheckCircle2 : undefined}
          title={result.message}
          variant={result.type}
        />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="support-name">Seu nome ou nome da loja</FieldLabel>
          <Input aria-invalid={name.length > 0 && normalizedName.length < 2} autoComplete="name" disabled={pending} id="support-name" maxLength={100} minLength={2} onChange={(event) => setName(event.target.value)} required value={name} />
          {name.length > 0 && normalizedName.length < 2 ? <FieldDescription>Informe pelo menos 2 caracteres.</FieldDescription> : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="support-email">E-mail para resposta</FieldLabel>
          <Input aria-invalid={email.length > 0 && !emailIsValid} autoComplete="email" disabled={pending} id="support-email" maxLength={254} onChange={(event) => setEmail(event.target.value)} required type="email" value={email} />
          {email.length > 0 && !emailIsValid ? <FieldDescription>Digite um e-mail válido, como nome@empresa.com.</FieldDescription> : null}
        </Field>
      </div>

      <fieldset className="grid min-w-0 gap-2">
        <legend className="mb-1 text-sm font-semibold text-[var(--app-foreground)]">Assunto</legend>
        <div className="grid min-w-0 gap-2 sm:grid-cols-2">
          {(Object.entries(topicContent) as [SupportTopic, (typeof topicContent)[SupportTopic]][]).map(([value, content]) => (
            <label className="min-w-0 cursor-pointer" key={value}>
              <input
                checked={topic === value}
                className="peer sr-only"
                disabled={pending}
                name="support-topic"
                onChange={() => setTopic(value)}
                type="radio"
                value={value}
              />
              <span className="flex min-h-11 w-full items-center rounded-[var(--radius-control)] border bg-white px-3 py-2 text-sm font-medium leading-5 transition-colors peer-checked:border-brand-700 peer-checked:bg-brand-100 peer-checked:text-brand-900 peer-focus-visible:ring-3 peer-focus-visible:ring-brand-200 peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                {content.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field>
        <FieldLabel htmlFor="support-message">Como podemos ajudar?</FieldLabel>
        <Textarea aria-invalid={message.length > 0 && missingMessageCharacters > 0} disabled={pending} id="support-message" maxLength={3000} minLength={10} onChange={(event) => setMessage(event.target.value)} placeholder={topicContent[topic].placeholder} required rows={6} value={message} />
        <FieldDescription>
          {missingMessageCharacters > 0
            ? `Escreva pelo menos 10 caracteres — faltam ${missingMessageCharacters}.`
            : `${message.length}/3000 caracteres.`}{" "}
          Não envie senha, dados completos de cartão ou códigos de autenticação.
        </FieldDescription>
      </Field>

      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="support-website">Site</label>
        <input autoComplete="off" id="support-website" name="website" tabIndex={-1} type="text" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-[var(--app-foreground-muted)]">Sua mensagem será enviada para {supportEmail}.</p>
        <Button className="w-full sm:w-auto" disabled={pending || !formIsValid} size="lg" type="submit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Send aria-hidden="true" />}
          {pending ? "Enviando..." : "Enviar mensagem"}
        </Button>
      </div>
    </form>
  );
}
