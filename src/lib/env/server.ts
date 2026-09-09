import "server-only";

import { z } from "zod";

export type AsaasEnv = {
  apiKey: string;
  apiUrl: string;
  environment: "production" | "sandbox";
};

const ASAAS_API_URL = {
  production: "https://api.asaas.com/v3",
  sandbox: "https://api-sandbox.asaas.com/v3",
} as const;

export function getSiteUrl(): string {
  const value = process.env.NEXT_PUBLIC_SITE_URL;
  const parsed = z.url().safeParse(value);

  return parsed.success ? parsed.data.replace(/\/$/, "") : "http://localhost:3000";
}

export function getAsaasEnv(): AsaasEnv | null {
  const apiKey = process.env.ASAAS_API_KEY?.trim();

  if (!apiKey) return null;

  if (apiKey.startsWith("$aact_prod_")) {
    return { apiKey, apiUrl: ASAAS_API_URL.production, environment: "production" };
  }

  if (apiKey.startsWith("$aact_hmlg_")) {
    return { apiKey, apiUrl: ASAAS_API_URL.sandbox, environment: "sandbox" };
  }

  const configuredApiUrl = process.env.ASAAS_API_URL?.trim().replace(/\/$/, "");
  if (configuredApiUrl === ASAAS_API_URL.production) {
    return { apiKey, apiUrl: ASAAS_API_URL.production, environment: "production" };
  }
  if (configuredApiUrl === ASAAS_API_URL.sandbox) {
    return { apiKey, apiUrl: ASAAS_API_URL.sandbox, environment: "sandbox" };
  }

  // Uma chave com prefixo desconhecido nunca deve cair silenciosamente em
  // Sandbox ou Produção. Chaves legadas exigem a URL oficial explícita.
  return null;
}

export function requireAsaasEnv(): AsaasEnv {
  const env = getAsaasEnv();

  if (!env) {
    throw new Error("Asaas ainda não foi configurado. Preencha ASAAS_API_KEY no servidor.");
  }

  return env;
}

export function requireAsaasWebhookToken(): string {
  const token = process.env.ASAAS_WEBHOOK_TOKEN?.trim();

  if (!token || token.length < 32 || token.length > 255) {
    throw new Error(
      "Preencha ASAAS_WEBHOOK_TOKEN com um segredo de 32 a 255 caracteres.",
    );
  }

  if (token === process.env.ASAAS_API_KEY?.trim()) {
    throw new Error("ASAAS_WEBHOOK_TOKEN deve ser diferente de ASAAS_API_KEY.");
  }

  return token;
}

export function requireSupabaseServiceRoleKey(): string {
  const result = z.string().min(1).safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!result.success) {
    throw new Error(
      "Supabase Admin ainda não foi configurado. Preencha SUPABASE_SERVICE_ROLE_KEY somente no servidor.",
    );
  }

  return result.data;
}
