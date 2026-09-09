"use client";

import { KeyRound } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";

import { loginWithPasswordAction } from "@/app/painel/actions";
import { Alert } from "@/components/ui/alert";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm() {
  const [state, action] = useActionState(loginWithPasswordAction, {});

  return (
    <form action={action} className="grid gap-5">
      <Field>
        <FieldLabel htmlFor="email">E-mail da assinatura</FieldLabel>
        <Input autoComplete="email" id="email" maxLength={254} name="email" placeholder="voce@empresa.com" required type="email" />
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-3">
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Link
            className="inline-flex min-h-11 items-center text-sm font-semibold text-brand-700 hover:underline"
            href="/painel/recuperar-senha"
          >
            Esqueci minha senha
          </Link>
        </div>
        <Input autoComplete="current-password" id="password" maxLength={256} name="password" placeholder="Sua senha" required type="password" />
      </Field>

      {state.error ? <Alert title={state.error} variant="danger" /> : null}
      <SubmitButton className="w-full" pendingLabel="Entrando...">
        <KeyRound aria-hidden="true" />
        Entrar no painel
      </SubmitButton>
    </form>
  );
}
