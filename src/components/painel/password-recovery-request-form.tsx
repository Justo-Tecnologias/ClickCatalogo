"use client";

import { LoaderCircle, Mail } from "lucide-react";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

export function PasswordRecoveryRequestForm() {
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
      const supabase = createClient();
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("next", "/painel/nova-senha");

      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: callbackUrl.toString() },
      );

      if (recoveryError) throw recoveryError;
      setSent(true);
    } catch {
      setError("Não foi possível solicitar a recuperação agora. Tente novamente em alguns minutos.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="grid gap-5" onSubmit={submit}>
      {sent ? (
        <Alert
          description="Se existir uma conta com esse e-mail, você receberá um link para criar uma nova senha. Verifique também a caixa de spam."
          title="Confira seu e-mail"
          variant="success"
        />
      ) : null}
      {error ? <Alert title={error} variant="danger" /> : null}

      <Field>
        <FieldLabel htmlFor="recovery-email">E-mail da assinatura</FieldLabel>
        <Input
          autoComplete="email"
          disabled={submitting}
          id="recovery-email"
          maxLength={254}
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com"
          required
          type="email"
          value={email}
        />
        <FieldDescription>Use o mesmo endereço utilizado para acessar o painel.</FieldDescription>
      </Field>

      <Button className="w-full" disabled={submitting} size="lg" type="submit">
        {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Mail aria-hidden="true" />}
        {submitting ? "Enviando..." : "Enviar link de recuperação"}
      </Button>
    </form>
  );
}
