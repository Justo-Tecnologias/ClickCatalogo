import "server-only";

import { z } from "zod";

import { getAsaasCheckoutPlan } from "@/lib/billing/server-plan";
import { requireAsaasEnv } from "@/lib/env/server";

const checkoutResponseSchema = z.object({
  id: z.string(),
  link: z.url().optional(),
});

export class AsaasSubscriptionCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasSubscriptionCancellationError";
  }
}

export type CreateCheckoutInput = {
  externalReference: string;
  nextDueDate: string;
  successUrl: string;
};

function checkoutUrl(id: string, link: string | undefined, apiUrl: string) {
  if (link) {
    const parsed = new URL(link);
    const officialHost = parsed.hostname === "asaas.com" || parsed.hostname.endsWith(".asaas.com");
    if (parsed.protocol === "https:" && officialHost) return parsed.toString();
  }

  const host = apiUrl.includes("sandbox") ? "https://sandbox.asaas.com" : "https://asaas.com";
  return `${host}/checkoutSession/show?id=${encodeURIComponent(id)}`;
}

export async function createRecurringCheckout(input: CreateCheckoutInput) {
  const env = requireAsaasEnv();
  const plan = getAsaasCheckoutPlan();
  const response = await fetch(`${env.apiUrl}/checkouts`, {
    body: JSON.stringify({
      billingTypes: ["CREDIT_CARD"],
      callback: {
        cancelUrl: input.successUrl.replace("/sucesso", ""),
        expiredUrl: input.successUrl.replace("/sucesso", ""),
        successUrl: input.successUrl,
      },
      chargeTypes: ["RECURRENT"],
      externalReference: input.externalReference,
      items: [{ description: plan.description, name: plan.name, quantity: 1, value: plan.value }],
      minutesToExpire: 60,
      subscription: { cycle: plan.cycle, nextDueDate: input.nextDueDate },
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
      access_token: env.apiKey,
    },
    method: "POST",
    signal: AbortSignal.timeout(15_000),
  });

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = z.object({ errors: z.array(z.object({ description: z.string() })).optional() }).safeParse(body);
    throw new Error(message.success ? message.data.errors?.[0]?.description ?? "O Asaas recusou a criação do checkout." : "O Asaas recusou a criação do checkout.");
  }

  const checkout = checkoutResponseSchema.parse(body);
  return { id: checkout.id, link: checkoutUrl(checkout.id, checkout.link, env.apiUrl) };
}

export async function cancelAsaasSubscription(subscriptionId: string) {
  const env = requireAsaasEnv();

  try {
    const response = await fetch(
      `${env.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
          access_token: env.apiKey,
        },
        method: "DELETE",
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (response.ok) return;

    if (response.status === 401) {
      throw new AsaasSubscriptionCancellationError(
        "O Asaas recusou a autenticação. A assinatura não foi cancelada; tente novamente mais tarde.",
      );
    }

    if (response.status === 404) {
      throw new AsaasSubscriptionCancellationError(
        "A assinatura não foi encontrada no Asaas. Nenhuma alteração foi confirmada; tente novamente mais tarde.",
      );
    }

    throw new AsaasSubscriptionCancellationError(
      "O Asaas não confirmou o cancelamento. Sua assinatura continua ativa; aguarde um instante e tente novamente.",
    );
  } catch (error) {
    if (error instanceof AsaasSubscriptionCancellationError) throw error;

    throw new AsaasSubscriptionCancellationError(
      "Não foi possível comunicar com o Asaas. Sua assinatura não foi cancelada; verifique sua conexão e tente novamente.",
    );
  }
}
