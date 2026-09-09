"use client";

import { KeyRound } from "lucide-react";
import { useRef } from "react";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

const HASH_PREFIX = "#confirmation_url=";

function confirmationUrlFromHash() {
  if (!window.location.hash.startsWith(HASH_PREFIX)) return null;

  const rawValue = window.location.hash.slice(HASH_PREFIX.length);
  if (!rawValue) return null;

  try {
    return decodeURIComponent(rawValue);
  } catch {
    return rawValue;
  }
}

export function RecoveryLinkConfirmation() {
  const confirmationInputRef = useRef<HTMLInputElement>(null);

  function prepareSubmission() {
    if (confirmationInputRef.current) {
      confirmationInputRef.current.value = confirmationUrlFromHash() ?? "";
    }
  }

  return (
    <form
      action="/auth/confirmar-recuperacao/continuar"
      className="grid gap-4"
      method="post"
      onSubmit={prepareSubmission}
    >
      <input name="confirmation_url" ref={confirmationInputRef} type="hidden" />
      <Alert
        description="Para proteger o link de uso único contra verificações automáticas do e-mail, confirme que deseja continuar."
        title="Seu link está pronto"
        variant="info"
      />
      <Button className="w-full" size="lg" type="submit">
        <KeyRound aria-hidden="true" />
        Continuar e criar nova senha
      </Button>
    </form>
  );
}
