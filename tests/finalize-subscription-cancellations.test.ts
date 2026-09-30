import assert from "node:assert/strict";
import test from "node:test";

import finalizeSubscriptionCancellations from "../netlify/functions/finalize-subscription-cancellations.mjs";

test("assinatura já excluída é conciliada e acesso volta ao mês comprovadamente pago", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalEnv = {
    ASAAS_API_KEY: process.env.ASAAS_API_KEY,
    ASAAS_API_URL: process.env.ASAAS_API_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
  process.env.ASAAS_API_KEY = "$aact_hmlg_test";
  process.env.ASAAS_API_URL = "https://api-sandbox.asaas.com/v3";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";

  let claims = 0;
  const updates: Record<string, unknown>[] = [];
  const requests: string[] = [];
  const logs: string[] = [];
  const response = (body: unknown, status = 200, headers?: HeadersInit) =>
    new Response(JSON.stringify(body), { headers, status });
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push(`${init?.method ?? "GET"} ${url.pathname}`);
    if (url.pathname.endsWith("/rpc/claim_subscription_cancellation_reconciliations")) {
      claims += 1;
      return response(claims === 1 ? [{
        access_until: "2026-11-10T03:00:00.000Z",
        asaas_subscription_id: "sub_deleted",
        cancellation_reconciliation_checked_at: "2026-09-23T13:15:00.000Z",
        id: "11111111-1111-4111-8111-111111111111",
      }] : []);
    }
    if (url.pathname.endsWith("/subscriptions/sub_deleted") && init?.method === "PUT") {
      return response({ errors: [{ description: "Assinatura removida" }] }, 400);
    }
    if (url.pathname.endsWith("/subscriptions") && url.searchParams.get("deletedOnly") === "true") {
      return response({ data: [{ id: "sub_deleted" }], hasMore: false });
    }
    if (url.pathname.endsWith("/payments") && init?.method !== "DELETE") {
      assert.equal(url.searchParams.get("subscription"), "sub_deleted");
      return response({ data: [{
        billingType: "CREDIT_CARD",
        dueDate: "2026-09-10",
        id: "pay_confirmed",
        status: "CONFIRMED",
      }], hasMore: false });
    }
    if (url.pathname.endsWith("/subscriptions") && init?.method === "PATCH") {
      updates.push(JSON.parse(String(init.body)));
      return response([{ id: "11111111-1111-4111-8111-111111111111" }]);
    }
    if (url.pathname.endsWith("/rpc/finalize_due_subscription_cancellations")) return response(0);
    if (url.pathname.endsWith("/rpc/claim_overdue_cancellations")) return response([]);
    if (url.pathname.endsWith("/subscriptions") && init?.method !== "PATCH") {
      return response([], 200, { "content-range": "*/0" });
    }
    throw new Error(`Requisição inesperada: ${init?.method ?? "GET"} ${url.pathname}`);
  };
  console.log = (value) => { logs.push(String(value)); };
  const originalError = console.error;
  console.error = () => undefined;

  try {
    await finalizeSubscriptionCancellations();
    console.error = originalError;
    assert.equal(JSON.parse(logs.at(-1)!).overdueCancellations.inspected, 0);
    assert.equal(updates.length, 1);
    assert.equal(updates[0].asaas_subscription_state, "deleted");
    assert.equal(updates[0].cancellation_reconciliation_status, "complete");
    assert.equal(updates[0].next_due_date, "2026-10-10");
    assert.equal(updates[0].access_until, "2026-10-10T03:00:00.000Z");
    assert.equal(requests.some((request) => request.startsWith("DELETE ")), false);
    assert.equal(JSON.parse(logs.at(-1)!).reconciliation.completed, 1);
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

type MockHandler = (url: URL, init: RequestInit | undefined) => Response | undefined;

async function runScheduledFunction(handler: MockHandler, extraEnv: Record<string, string> = {}) {
  const keys = ["ASAAS_API_KEY", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_SUPABASE_URL", "RESEND_API_KEY", "RESEND_FROM_EMAIL", "SUPABASE_SERVICE_ROLE_KEY"];
  const originalEnv = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  for (const key of keys) delete process.env[key];
  Object.assign(process.env, {
    ASAAS_API_KEY: "$aact_hmlg_test",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "test-service-role",
    ...extraEnv,
  });

  const requests: { body: unknown; headers: Headers; method: string; url: URL }[] = [];
  const logs: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    requests.push({ body: init?.body ? JSON.parse(String(init.body)) : null, headers: new Headers(init?.headers), method, url });
    const custom = handler(url, init);
    if (custom) return custom;
    if (url.pathname.endsWith("/rpc/claim_subscription_cancellation_reconciliations")) return Response.json([]);
    if (url.pathname.endsWith("/rpc/claim_overdue_cancellations")) return Response.json([]);
    if (url.pathname.endsWith("/rpc/claim_overdue_notices")) return Response.json([]);
    if (url.pathname.endsWith("/rpc/finalize_due_subscription_cancellations")) return Response.json(0);
    if (url.pathname.endsWith("/rest/v1/subscriptions") && method === "GET") {
      return new Response("[]", { headers: { "content-range": "*/0" } });
    }
    throw new Error(`Requisição inesperada: ${method} ${url.pathname}`);
  };
  console.log = (value) => { logs.push(String(value)); };
  console.error = () => undefined;

  try {
    await finalizeSubscriptionCancellations();
    return { requests, summary: JSON.parse(logs.at(-1)!) };
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test("30º dia de atraso: inativa recorrência, remove fatura aberta e só então encerra", async () => {
  const row = {
    asaas_subscription_id: "sub_overdue",
    id: "22222222-2222-4222-8222-222222222222",
    overdue_cancellation_checked_at: "2026-11-09T03:15:00.000Z",
    overdue_since: "2026-10-10",
    tenant_id: "33333333-3333-4333-8333-333333333333",
  };
  let overdueClaims = 0;
  let paymentLists = 0;

  const { requests, summary } = await runScheduledFunction((url, init) => {
    if (url.pathname.endsWith("/rpc/claim_overdue_cancellations")) {
      overdueClaims += 1;
      return Response.json(overdueClaims === 1 ? [row] : []);
    }
    if (url.pathname.endsWith("/subscriptions/sub_overdue") && init?.method === "PUT") return Response.json({ id: "sub_overdue" });
    if (url.pathname.endsWith("/payments") && (init?.method ?? "GET") === "GET") {
      paymentLists += 1;
      return Response.json({
        data: paymentLists === 1
          ? [
            { dueDate: "2026-09-10", id: "pay_old", status: "CONFIRMED" },
            { dueDate: "2026-10-10", id: "pay_overdue", status: "OVERDUE" },
            { dueDate: "2026-11-10", id: "pay_next", status: "PENDING" },
          ]
          : [{ dueDate: "2026-09-10", id: "pay_old", status: "CONFIRMED" }],
        hasMore: false,
      });
    }
    if (url.pathname.includes("/payments/") && init?.method === "DELETE") return Response.json({ deleted: true });
    if (url.pathname.endsWith("/rpc/finalize_overdue_cancellation")) return Response.json(true);
    return undefined;
  });

  const deleted = requests.filter((request) => request.method === "DELETE").map((request) => request.url.pathname.split("/").at(-1));
  assert.deepEqual(deleted.sort(), ["pay_next", "pay_overdue"]);
  const finalize = requests.find((request) => request.url.pathname.endsWith("/rpc/finalize_overdue_cancellation"));
  assert.deepEqual(finalize?.body, {
    p_checked_at: row.overdue_cancellation_checked_at,
    p_remote_state: "inactive",
    p_subscription_id: row.id,
  });
  const inactivationIndex = requests.findIndex((request) => request.method === "PUT");
  const finalizeIndex = requests.findIndex((request) => request.url.pathname.endsWith("/rpc/finalize_overdue_cancellation"));
  assert.ok(inactivationIndex >= 0 && inactivationIndex < finalizeIndex);
  assert.equal(summary.overdueCancellations.canceled, 1);
  assert.equal(summary.overdueNotices.skipped, "resend_not_configured");
});

test("30º dia de atraso: pagamento identificado impede o encerramento", async () => {
  let overdueClaims = 0;
  const { requests, summary } = await runScheduledFunction((url, init) => {
    if (url.pathname.endsWith("/rpc/claim_overdue_cancellations")) {
      overdueClaims += 1;
      return Response.json(overdueClaims === 1 ? [{
        asaas_subscription_id: "sub_paid",
        id: "44444444-4444-4444-8444-444444444444",
        overdue_cancellation_checked_at: "2026-11-09T03:15:00.000Z",
        overdue_since: "2026-10-10",
        tenant_id: "55555555-5555-4555-8555-555555555555",
      }] : []);
    }
    if (url.pathname.endsWith("/subscriptions/sub_paid") && init?.method === "PUT") return Response.json({ id: "sub_paid" });
    if (url.pathname.endsWith("/payments")) {
      return Response.json({ data: [{ dueDate: "2026-10-10", id: "pay_late", status: "RECEIVED" }], hasMore: false });
    }
    if (url.pathname.endsWith("/rest/v1/subscriptions") && init?.method === "PATCH") return Response.json([]);
    return undefined;
  });

  assert.equal(requests.some((request) => request.url.pathname.endsWith("/rpc/finalize_overdue_cancellation")), false);
  assert.equal(requests.some((request) => request.method === "DELETE"), false);
  const attention = requests.find((request) => request.method === "PATCH");
  assert.equal((attention?.body as Record<string, unknown>).overdue_cancellation_status, "attention");
  assert.equal(summary.overdueCancellations.attention, 1);
});

test("aviso de atraso é enviado uma vez com chave idempotente e registrado", async () => {
  const notice = {
    invoice_url: "https://www.asaas.com/i/abc",
    nome_loja: "Loja Teste",
    notice_day: 6,
    overdue_since: "2026-10-10",
    owner_email: "titular@example.com",
    slug: "loja-teste",
    subscription_id: "66666666-6666-4666-8666-666666666666",
    tenant_id: "77777777-7777-4777-8777-777777777777",
  };
  const { requests, summary } = await runScheduledFunction((url, init) => {
    if (url.pathname.endsWith("/rpc/claim_overdue_notices")) return Response.json([notice]);
    if (url.hostname === "api.resend.com") return Response.json({ id: "email_1" });
    if (url.pathname.endsWith("/rest/v1/subscriptions") && init?.method === "PATCH") return new Response(null, { status: 204 });
    return undefined;
  }, {
    NEXT_PUBLIC_SITE_URL: "https://clickcatalogo.com",
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "ClickCatálogo <contato@clickcatalogo.com>",
  });

  const email = requests.find((request) => request.url.hostname === "api.resend.com");
  assert.equal(email?.headers.get("Idempotency-Key"), `overdue-${notice.subscription_id}-2026-10-10-6`);
  assert.deepEqual((email?.body as { to: string[] }).to, ["titular@example.com"]);
  const record = requests.find((request) => request.method === "PATCH");
  assert.equal(record?.url.searchParams.get("overdue_since"), "eq.2026-10-10");
  assert.deepEqual(record?.body, { overdue_last_notice_day: 6, overdue_notice_claimed_at: null });
  assert.equal(summary.overdueNotices.sent, 1);
});
