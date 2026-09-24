import "server-only";

import { z } from "zod";

import { recurringCheckoutPayload, subscriptionStatusPayload } from "@/lib/asaas/contracts";
import { classifySubscriptionUpdateResponse } from "@/lib/asaas/subscription-update-outcome";
import {
  authoritativePaidThroughDate,
  selectFuturePendingSubscriptionPayments,
  selectSubscriptionPaymentsAtOrAfter,
  type AsaasSubscriptionPayment,
} from "@/lib/asaas/payments";
import { getAsaasCheckoutPlan } from "@/lib/billing/server-plan";
import { requireAsaasEnv } from "@/lib/env/server";

const checkoutResponseSchema = z.object({
  id: z.string(),
  link: z.url().optional(),
});

const subscriptionPaymentSchema = z.object({
  billingType: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  id: z.string().min(1),
  status: z.string().min(1),
  subscription: z.string().nullable().optional(),
}).passthrough();

const subscriptionPaymentsResponseSchema = z.object({
  data: z.array(subscriptionPaymentSchema),
  hasMore: z.boolean().optional(),
}).passthrough();

const subscriptionResponseSchema = z.object({
  id: z.string().min(1),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).passthrough();

const subscriptionStateSchema = subscriptionResponseSchema.extend({
  status: z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]),
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

export class AsaasSubscriptionUpdateError extends Error {
  constructor(message: string, public readonly outcome: "rejected" | "unknown") {
    super(message);
    this.name = "AsaasSubscriptionUpdateError";
  }
}

export class AsaasPaymentReconciliationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AsaasPaymentReconciliationError";
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

    const outcome = classifySubscriptionUpdateResponse(response.status);
    if (outcome === "updated" || outcome === "deleted") return outcome;
    if (outcome === "unknown") {
      throw new AsaasSubscriptionUpdateError("O resultado da operação no Asaas ainda não foi confirmado.", "unknown");
    }
    throw new AsaasSubscriptionUpdateError("O Asaas não aceitou a alteração da assinatura.", "rejected");
  } catch (error) {
    if (error instanceof AsaasSubscriptionUpdateError) throw error;
    throw new AsaasSubscriptionUpdateError("A comunicação com o Asaas foi interrompida antes da confirmação.", "unknown");
  }
}

export function inactivateAsaasSubscription(subscriptionId: string) {
  return updateAsaasSubscription(subscriptionId, { status: "INACTIVE" });
}

export async function getAsaasSubscriptionState(subscriptionId: string) {
  const env = requireAsaasEnv();
  const response = await fetch(`${env.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
    cache: "no-store",
    headers: { Accept: "application/json", "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`, access_token: env.apiKey },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Não foi possível consultar o estado da assinatura no Asaas.");
  const parsed = subscriptionStateSchema.safeParse(await response.json().catch(() => null));
  if (!parsed.success || parsed.data.id !== subscriptionId) throw new Error("O Asaas devolveu um estado de assinatura inválido.");
  return parsed.data;
}

async function listSubscriptionPayments(subscriptionId: string, status?: "PENDING") {
  const env = requireAsaasEnv();
  const payments: AsaasSubscriptionPayment[] = [];
  const limit = 100;

  for (let offset = 0; offset < 2_000; offset += limit) {
    // A listagem da assinatura pode falhar depois da exclusão no Asaas.
    // O filtro global continua permitindo conciliar as cobranças vinculadas.
    const url = new URL(`${env.apiUrl}/payments`);
    url.searchParams.set("subscription", subscriptionId);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    if (status) url.searchParams.set("status", status);

    let response: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        response = await fetch(url, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
            access_token: env.apiKey,
          },
          method: "GET",
          signal: AbortSignal.timeout(15_000),
        });
        if (response.ok || response.status < 500 || attempt === 2) break;
      } catch {
        if (attempt === 2) {
          throw new AsaasPaymentReconciliationError(
            "Não foi possível consultar as cobranças da assinatura.",
          );
        }
      }
    }

    if (!response?.ok) {
      throw new AsaasPaymentReconciliationError(
        "O Asaas não confirmou as cobranças pendentes da assinatura.",
      );
    }

    const parsed = subscriptionPaymentsResponseSchema.safeParse(
      await response.json().catch(() => null),
    );
    if (!parsed.success) {
      throw new AsaasPaymentReconciliationError(
        "O Asaas devolveu uma lista de cobranças inválida.",
      );
    }

    if (parsed.data.data.some((payment) => payment.subscription && payment.subscription !== subscriptionId)) {
      throw new AsaasPaymentReconciliationError(
        "O Asaas devolveu uma cobrança sem vínculo confirmado com a assinatura.",
      );
    }

    payments.push(...parsed.data.data);
    if (!parsed.data.hasMore || parsed.data.data.length < limit) return payments;
  }

  throw new AsaasPaymentReconciliationError(
    "A assinatura possui cobranças demais para conciliação automática.",
  );
}

async function deletePendingPayment(paymentId: string) {
  const env = requireAsaasEnv();

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await fetch(
        `${env.apiUrl}/payments/${encodeURIComponent(paymentId)}`,
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

      if (response.ok || response.status === 404) return;
      if (response.status >= 500 && attempt === 1) continue;
      throw new AsaasPaymentReconciliationError(
        "O Asaas não removeu uma cobrança futura pendente.",
      );
    } catch (error) {
      if (error instanceof AsaasPaymentReconciliationError) throw error;
      if (attempt === 2) {
        throw new AsaasPaymentReconciliationError(
          "Não foi possível remover uma cobrança futura pendente.",
        );
      }
    }
  }
}

export async function reconcileFuturePendingSubscriptionPayments(
  subscriptionId: string,
  accessUntilDate: string,
) {
  const payments = await listSubscriptionPayments(subscriptionId, "PENDING");
  const removable = selectFuturePendingSubscriptionPayments(
    payments,
    subscriptionId,
    accessUntilDate,
  );

  for (const payment of removable) await deletePendingPayment(payment.id);

  const remaining = selectSubscriptionPaymentsAtOrAfter(
    await listSubscriptionPayments(subscriptionId),
    subscriptionId,
    accessUntilDate,
  );
  if (remaining.length > 0) {
    throw new AsaasPaymentReconciliationError(
      "Ainda existe uma cobrança do próximo período que requer conferência.",
    );
  }

  return { removedCount: removable.length };
}

export async function getAsaasSubscriptionPaidThroughDate(subscriptionId: string) {
  try {
    const env = requireAsaasEnv();
    const [payments, subscriptionResponse] = await Promise.all([
      listSubscriptionPayments(subscriptionId),
      fetch(`${env.apiUrl}/subscriptions/${encodeURIComponent(subscriptionId)}`, {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "User-Agent": `ClickCatalogo/0.1.0 (${env.environment})`,
          access_token: env.apiKey,
        },
        signal: AbortSignal.timeout(15_000),
      }),
    ]);
    if (!subscriptionResponse.ok) throw new AsaasPaymentReconciliationError("Assinatura não encontrada.");
    const subscription = subscriptionResponseSchema.safeParse(
      await subscriptionResponse.json().catch(() => null),
    );
    if (!subscription.success || subscription.data.id !== subscriptionId) {
      throw new AsaasPaymentReconciliationError("Resposta de assinatura inválida.");
    }
    return authoritativePaidThroughDate(
      payments,
      subscriptionId,
      subscription.data.nextDueDate,
    );
  } catch (error) {
    if (error instanceof AsaasPaymentReconciliationError) {
      throw new AsaasSubscriptionCancellationError(
        "Não foi possível consultar as cobranças para confirmar o período já pago. A assinatura não foi cancelada.",
      );
    }
    throw new AsaasSubscriptionCancellationError(
      "O Asaas não informou uma cobrança paga que permita cancelar com segurança. A assinatura não foi alterada.",
    );
  }
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
    if (error instanceof AsaasSubscriptionUpdateError) throw error;
    if (error instanceof AsaasSubscriptionReactivationError) throw error;
    throw new AsaasSubscriptionReactivationError(
      error instanceof Error
        ? error.message
        : "Não foi possível reativar a assinatura no Asaas.",
    );
  }
}
