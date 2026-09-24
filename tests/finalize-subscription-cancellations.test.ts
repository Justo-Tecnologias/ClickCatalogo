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
      return new Response(null, { status: 404 });
    }
    if (url.pathname.endsWith("/payments") && init?.method !== "DELETE") {
      assert.equal(url.searchParams.get("subscription"), "sub_deleted");
      return response({ data: [{
        billingType: "CREDIT_CARD",
        dueDate: "2026-09-10",
        id: "pay_confirmed",
        status: "CONFIRMED",
        subscription: "sub_deleted",
      }], hasMore: false });
    }
    if (url.pathname.endsWith("/subscriptions") && init?.method === "PATCH") {
      updates.push(JSON.parse(String(init.body)));
      return response([{ id: "11111111-1111-4111-8111-111111111111" }]);
    }
    if (url.pathname.endsWith("/rpc/finalize_due_subscription_cancellations")) return response(0);
    if (url.pathname.endsWith("/subscriptions") && init?.method !== "PATCH") {
      return response([], 200, { "content-range": "*/0" });
    }
    throw new Error(`Requisição inesperada: ${init?.method ?? "GET"} ${url.pathname}`);
  };
  console.log = (value) => { logs.push(String(value)); };

  try {
    await finalizeSubscriptionCancellations();
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
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
