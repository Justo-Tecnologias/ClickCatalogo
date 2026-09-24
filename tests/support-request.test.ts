import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("formulário de atendimento valida origem, limita abuso e não expõe a chave de envio", async () => {
  const route = await readFile(new URL("../src/app/api/atendimento/route.ts", import.meta.url), "utf8");
  const form = await readFile(new URL("../src/components/marketing/support-contact.tsx", import.meta.url), "utf8");

  assert.match(route, /enforceSameOrigin\(request\)/);
  assert.match(route, /PUBLIC_API_RATE_LIMITS\.supportIp/);
  assert.match(route, /PUBLIC_API_RATE_LIMITS\.supportEmail/);
  assert.match(route, /replyTo: parsed\.data\.email/);
  assert.match(route, /website: z\.string\(\)\.max\(200\)/);
  assert.match(route, /"sugestao", "problema"/);
  assert.match(route, /Navegador\/dispositivo/);
  assert.match(route, /if \(parsed\.data\.website\)/);
  assert.match(form, /fetch\("\/api\/atendimento"/);
  assert.match(form, /window\.navigator\.userAgent/);
  assert.match(form, /response\.headers\.get\("Retry-After"\)/);
  assert.match(form, /Sugestão de melhoria/);
  assert.match(form, /Relatar problema/);
  assert.doesNotMatch(form, /RESEND_API_KEY/);
});
