"use client";

import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type PasswordFieldsProps = {
  confirmation: string;
  disabled?: boolean;
  idPrefix: string;
  onConfirmationChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  password: string;
};

export function PasswordFields({
  confirmation,
  disabled = false,
  idPrefix,
  onConfirmationChange,
  onPasswordChange,
  password,
}: PasswordFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-password`}>Nova senha</FieldLabel>
        <Input
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-password`}
          maxLength={128}
          minLength={8}
          onChange={(event) => onPasswordChange(event.target.value)}
          required
          type="password"
          value={password}
        />
        <FieldDescription>Mínimo de 8 caracteres.</FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${idPrefix}-confirmation`}>Confirmar senha</FieldLabel>
        <Input
          autoComplete="new-password"
          disabled={disabled}
          id={`${idPrefix}-confirmation`}
          maxLength={128}
          minLength={8}
          onChange={(event) => onConfirmationChange(event.target.value)}
          required
          type="password"
          value={confirmation}
        />
      </Field>
    </div>
  );
}
