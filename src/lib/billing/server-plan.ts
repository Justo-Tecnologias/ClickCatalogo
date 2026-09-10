import "server-only";

import { z } from "zod";

import { CLICKCATALOGO_MONTHLY_PLAN } from "@/lib/billing/plan";

const controlledTestValueSchema = z
  .string()
  .regex(/^\d+(?:\.\d{1,2})?$/, "Use reais com ponto e no máximo duas casas decimais.")
  .transform(Number)
  .pipe(z.number().min(5).lt(CLICKCATALOGO_MONTHLY_PLAN.value));

export function getAsaasCheckoutPlan() {
  const configuredValue = process.env.ASAAS_CHECKOUT_TEST_VALUE?.trim();

  if (!configuredValue) return CLICKCATALOGO_MONTHLY_PLAN;

  const parsed = controlledTestValueSchema.safeParse(configuredValue);
  if (!parsed.success) {
    throw new Error(
      `ASAAS_CHECKOUT_TEST_VALUE inválido. Para um teste controlado, use um valor entre R$ 5,00 e R$ ${(CLICKCATALOGO_MONTHLY_PLAN.value - 0.01).toFixed(2)}.`,
    );
  }

  return {
    ...CLICKCATALOGO_MONTHLY_PLAN,
    name: "ClickCatálogo — teste",
    value: parsed.data,
  };
}
