"use client";

import { KeyRound, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PasswordFields } from "@/components/painel/password-fields";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type PasswordSetupFormProps = {
  onConfigured: () => void;
  reference: string;
};

export function PasswordSetupForm({ onConfigured, reference }: PasswordSetupFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Crie uma senha com pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmation) {
      setError("As duas senhas precisam ser iguais.");
      return;
    }

    setSubmitting(true);

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const response = await fetch("/api/cadastro/definir-senha", {
        body: JSON.stringify({ email: normalizedEmail, password, reference }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const result = await response.json() as { configured?: boolean; error?: string };

      if (!response.ok) {
        if (result.configured) onConfigured();
        throw new Error(result.error ?? "Não foi possível criar a senha.");
      }

      const supabase = createClient();
      const { error: loginError } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });

      if (loginError) {
        onConfigured();
        throw new Error("Acesso configurado. Entre pelo painel com seus dados.");
      }

      router.replace("/painel/loja");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Não foi possível criar a senha.");
      setSubmitting(false);
    }
  }

  return (
    <form className="mt-6 grid gap-4 rounded-[var(--radius-card)] border bg-[var(--app-surface-muted)] p-4 sm:p-5" onSubmit={submit}>
      <div>
        <div className="flex items-center gap-2 font-semibold">
          <KeyRound aria-hidden="true" className="size-5 text-brand-700" />
          Crie sua senha de acesso
        </div>
        <p className="mt-1 text-sm leading-6 text-[var(--app-foreground-muted)]">
          Informe o e-mail usado no cadastro e escolha uma senha segura.
        </p>
      </div>

      {error ? <Alert title={error} variant="danger" /> : null}

      <Field>
        <FieldLabel htmlFor="setup-email">E-mail da assinatura</FieldLabel>
        <Input
          autoComplete="email"
          disabled={submitting}
          id="setup-email"
          maxLength={254}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="voce@empresa.com"
          required
          type="email"
          value={email}
        />
      </Field>

      <PasswordFields
        confirmation={confirmation}
        disabled={submitting}
        idPrefix="setup"
        onConfirmationChange={setConfirmation}
        onPasswordChange={setPassword}
        password={password}
      />

      <Button disabled={submitting} size="lg" type="submit">
        {submitting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <KeyRound aria-hidden="true" />}
        {submitting ? "Criando acesso..." : "Criar senha e entrar"}
      </Button>
    </form>
  );
}
