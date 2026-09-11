import "server-only";

import { z } from "zod";

import { recurringCheckoutPayload, subscriptionStatusPayload } from "@/lib/asaas/contracts";
import { getAsaasCheckoutPlan } from "@/lib/billing/server-plan";
import { requireAsaasEnv } from "@/lib/env/server";

const checkoutResponseSchema = z.object({
  id: z.string(),
  link: z.url().optional(),
});

const subscriptionResponseSchema = z.object({
  id: z.string(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export class AsaasSubscriptionCancellationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasSubscriptionCancellationError";
  }
}

export class AsaasSubscriptionReactivationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasSubscriptionReactivationError";
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
    body: JSON.stringify(recurringCheckoutPayload({
      cancelUrl: input.successUrl.replace("/sucesso", ""),
      description: plan.description,
      externalReference: input.externalReference,
      name: plan.name,
      nextDueDate: input.nextDueDate,
      successUrl: input.successUrl,
      value: plan.value,
    })),
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

async function updateAsaasSubscription(
  subscriptionId: string,
  body: { nextDueDate?: string; status: "ACTIVE" | "INACTIVE" },
) {
  const env = requireAsaasEnv();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(
        `${env.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
        {
          body: JSON.stringify(subscriptionStatusPayload(body.status, body.nextDueDate)),
          method: "PUT",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
            access_token: env.apiKey,
          },
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (response.ok) return "updated" as const;
      if (response.status === 404) return "deleted" as const;

      if (response.status === 401) {
        throw new AsaasSubscriptionCancellationError(
          "O Asaas recusou a autenticação. A assinatura não foi alterada; tente novamente mais tarde.",
        );
      }

      throw new AsaasSubscriptionCancellationError(
        "O Asaas não confirmou a alteração da assinatura. Aguarde um instante e tente novamente.",
      );
    } catch (error) {
      if (error instanceof AsaasSubscriptionCancellationError) throw error;
      if (attempt === 1) continue;

      throw new AsaasSubscriptionCancellationError(
        "Não foi possível comunicar com o Asaas. Nenhuma alteração foi confirmada; tente novamente.",
      );
    }
  }

  throw new AsaasSubscriptionCancellationError(
    "Não foi possível confirmar a alteração da assinatura.",
  );
}

export function inactivateAsaasSubscription(subscriptionId: string) {
  return updateAsaasSubscription(subscriptionId, { status: "INACTIVE" });
}

export async function reactivateAsaasSubscription(
  subscriptionId: string,
  nextDueDate: string,
) {
  try {
    const result = await updateAsaasSubscription(subscriptionId, {
      nextDueDate,
      status: "ACTIVE",
    });
    if (result === "deleted") {
      throw new AsaasSubscriptionReactivationError(
        "Esta recorrência foi encerrada definitivamente e precisa de uma nova contratação.",
      );
    }
  } catch (error) {
    if (error instanceof AsaasSubscriptionReactivationError) throw error;
    throw new AsaasSubscriptionReactivationError(
      error instanceof Error
        ? error.message
        : "Não foi possível reativar a assinatura no Asaas.",
    );
  }
}

export async function getAsaasSubscriptionNextDueDate(subscriptionId: string) {
  const env = requireAsaasEnv();

  try {
    const response = await fetch(
      `${env.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
          access_token: env.apiKey,
        },
        method: "GET",
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!response.ok) {
      throw new AsaasSubscriptionCancellationError(
        "Não foi possível confirmar até quando o período atual está pago. A assinatura não foi cancelada.",
      );
    }

    const parsed = subscriptionResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success || parsed.data.id !== subscriptionId) {
      throw new AsaasSubscriptionCancellationError(
        "O Asaas não informou a próxima renovação com segurança. A assinatura não foi cancelada.",
      );
    }

    return parsed.data.nextDueDate;
  } catch (error) {
    if (error instanceof AsaasSubscriptionCancellationError) throw error;
    throw new AsaasSubscriptionCancellationError(
      "Não foi possível consultar o período pago no Asaas. Verifique sua conexão e tente novamente.",
    );
  }
}
