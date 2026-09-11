"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export function SignupRecoveryForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSent(false);
    setSubmitting(true);
    try {
      const response = await fetch("/api/cadastro/recuperar", {
        body: JSON.stringify({ email }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("recovery_request_failed");
      }

      setSent(true);
    } catch {
      setError("Não foi possível enviar as instruções agora. Confira sua conexão e tente novamente em alguns minutos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {sent ? (
        <Alert
          description="Se encontrarmos um cadastro relacionado a este e-mail, enviaremos um link de uso único. Verifique também a caixa de spam."
          title="Confira seu e-mail"
          variant="success"
        />
      ) : null}
      {error ? <Alert description={error} title="Não concluímos a solicitação" variant="danger" /> : null}
      <Field>
        <FieldLabel htmlFor="signup-recovery-email">E-mail usado na contratação</FieldLabel>
        <Input
          autoComplete="email"
          disabled={submitting}
          id="signup-recovery-email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com"
          required
          type="email"
          value={email}
        />
        <FieldDescription>O link expira em 20 minutos e funciona uma única vez.</FieldDescription>
      </Field>
      <Button disabled={submitting} size="lg" type="submit">
        {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Mail aria-hidden="true" />}
        {submitting ? "Solicitando..." : "Enviar instruções"}
      </Button>
    </form>
  );
}
