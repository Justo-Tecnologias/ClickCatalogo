import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { draftReminderEmail, verificationEmail, welcomeEmail } from "../src/lib/signup/draft-emails.mjs";

const read = (path: string) => readFileSync(path, "utf8");
const siteUrl = "https://clickcatalogo.com";
const optOutUrl = `${siteUrl}/lembretes/parar#t=00000000-0000-4000-8000-000000000000`;

test("lembretes acompanham o progresso e sempre oferecem parar", () => {
  for (const day of [1, 3, 7] as const) {
    const empty = draftReminderEmail({ day, optOutUrl, productCount: 0, siteUrl, storeName: "Loja <Teste>" });
    const ready = draftReminderEmail({ day, optOutUrl, productCount: 3, siteUrl, storeName: "Loja <Teste>" });
    assert.match(empty.html, /\/painel\/produtos/);
    assert.match(empty.html, /Adicionar produtos/);
    assert.match(ready.html, /\/painel\/loja/);
    assert.match(ready.html, /Publicar minha loja/);
    for (const email of [empty, ready]) {
      assert.match(email.html, /Não quero mais receber lembretes/);
      assert.ok(email.html.includes(optOutUrl));
      // Nome da loja escapado no HTML e em texto puro no assunto.
      assert.match(email.html, /Loja &lt;Teste&gt;/);
      assert.match(email.subject, /Loja <Teste>$/);
    }
  }
  assert.match(draftReminderEmail({ day: 7, optOutUrl, productCount: 0, siteUrl, storeName: "A" }).html, /30 dias/);
  assert.match(draftReminderEmail({ day: 1, optOutUrl, productCount: 1, siteUrl, storeName: "A" }).html, /1 produto/);
});

test("boas-vindas e reenvio levam ao link de confirmação de uso único", () => {
  const verifyUrl = `${siteUrl}/cadastro/confirmar-email#token=abc`;
  for (const email of [welcomeEmail({ siteUrl, storeName: "Ateliê", verifyUrl }), verificationEmail({ storeName: "Ateliê", verifyUrl })]) {
    assert.ok(email.html.includes(verifyUrl));
    assert.match(email.html, /Confirmar meu e-mail/);
    assert.match(email.subject, /^Confirme seu e-mail — Ateliê$/);
  }
});

test("cadastro gratuito cria rascunho com senha, sem abrir cobrança", () => {
  const route = read("src/app/api/cadastro/criar/route.ts");
  assert.match(route, /status: "rascunho"/);
  assert.match(route, /enforceSameOrigin/);
  assert.match(route, /PUBLIC_API_RATE_LIMITS\.draftSignup/);
  assert.match(route, /signInWithPassword/);
  assert.match(route, /kind: "welcome"/);
  assert.doesNotMatch(route, /createRecurringCheckout|asaas/i);
  // O registro de aceites aponta para a loja criada.
  assert.match(route, /provisioned_tenant_id: tenant\.id/);
  assert.ok(!existsSync("src/app/api/checkout/asaas/route.ts"), "o cadastro pago antigo não deve continuar exposto");
  const form = read("src/components/cadastro/signup-form.tsx");
  assert.match(form, /"\/api\/cadastro\/criar"/);
  assert.match(form, /Criar minha loja grátis/);
  assert.doesNotMatch(form, /\/api\/checkout\/asaas/);
});

test("publicar exige e-mail confirmado, produto e passa pelo checkout", () => {
  const action = read("src/app/painel/(app)/loja/publish-actions.ts");
  assert.match(action, /tenant\.status !== "rascunho"/);
  assert.match(action, /!tenant\.email_confirmado_em/);
  assert.match(action, /blocker: "products"/);
  assert.match(action, /createRecurringCheckout\(/);
  assert.match(action, /successUrl: `\$\{siteUrl\}\/painel\/loja\?publicacao=retorno`/);
  // A loja só vai ao ar pelo webhook: a ação não muda o status.
  assert.doesNotMatch(action, /status: "ativo"/);
  const webhook = read("src/app/api/webhooks/asaas/route.ts");
  assert.match(webhook, /from\("tenants"\)\.update\(\{ status: "ativo" \}\)/);
  assert.match(webhook, /email_confirmado_em: new Date\(\)\.toISOString\(\)/);
});

test("rascunho fica fora do ar e o painel bloqueia a divulgação", () => {
  const page = read("src/app/loja/[slug]/page.tsx");
  assert.match(page, /store\.kind === "draft"/);
  assert.match(page, /Loja em preparação/);
  const catalog = read("src/lib/catalog/public-catalog.ts");
  assert.match(catalog, /status === "rascunho"/);
  assert.match(catalog, /get_public_draft_store_name/);
  const storePage = read("src/app/painel/(app)/loja/page.tsx");
  assert.match(storePage, /locked=\{draft\}/);
  assert.match(storePage, /actions=\{draft \? undefined :/);
  const layout = read("src/app/painel/(app)/layout.tsx");
  assert.match(layout, /touch_draft_last_seen/);
  assert.match(layout, /<DraftBanner /);
});

test("banco: rascunho não é público, titular não publica sozinho e rotinas são restritas", () => {
  const migration = read("supabase/migrations/202610020029_free_draft_signup.sql").toLowerCase();
  const schema = read("supabase/schema.sql").toLowerCase();
  for (const sql of [migration, schema]) {
    assert.match(sql, /status in \('rascunho', 'ativo', 'inadimplente', 'cancelado'\)/);
    for (const fn of ["claim_draft_reminders\\(integer\\)", "claim_stale_drafts\\(integer\\)", "delete_stale_draft\\(uuid\\)", "consume_email_verification_token\\(text\\)"]) {
      assert.match(sql, new RegExp(`revoke all on function public\\.${fn} from public, anon, authenticated;`));
      assert.match(sql, new RegExp(`grant execute on function public\\.${fn} to service_role;`));
    }
    assert.match(sql, /grant execute on function public\.touch_draft_last_seen\(\) to authenticated;/);
    assert.match(sql, /interval '30 days'/);
  }
  // O catálogo público continua exigindo loja ativa ou inadimplente.
  assert.match(schema, /tenant\.status in \('ativo', 'inadimplente'\)\s+and not exists/);
  // A lista de colunas editáveis pelo titular não inclui status nem a confirmação de e-mail.
  const grant = schema.match(/grant update \(([^)]*)\) on table public\.tenants to authenticated/)?.[1] ?? "";
  assert.doesNotMatch(grant, /\bstatus\b|email_confirmado_em|draft_|lembretes/);
});

test("rotina de rascunhos: lembretes idempotentes e exclusão em etapas", () => {
  const fn = read("netlify/functions/draft-lifecycle.mjs");
  assert.match(fn, /schedule: "45 \* \* \* \*"/);
  assert.match(fn, /idempotencyKey: `draft-reminder-\$\{row\.tenant_id\}-\$\{row\.reminder_day\}`/);
  assert.match(fn, /\/lembretes\/parar#t=/);
  // Fotos primeiro, loja depois (RPC confere de novo o prazo), usuário do Auth por último.
  const order = ["removeStorageFolder(env, row.tenant_id)", "rpc/delete_stale_draft", "/auth/v1/admin/users/"].map((part) => fn.indexOf(part));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("destino após o login aceita só telas do painel", async () => {
  const { safePanelNextPath } = await import("../src/lib/auth/next-path");
  assert.equal(safePanelNextPath("/painel/produtos"), "/painel/produtos");
  assert.equal(safePanelNextPath("/painel/loja"), "/painel/loja");
  for (const unsafe of ["//evil.com", "https://evil.com/painel/loja", "/painel/../loja/x", "/loja/x", "/painel", "/painel/loja?x=1", null, 42]) {
    assert.equal(safePanelNextPath(unsafe), null, String(unsafe));
  }
  // Lembrete leva direto à tela certa, passando pelo login quando preciso.
  assert.match(draftReminderEmail({ day: 1, optOutUrl, productCount: 0, siteUrl, storeName: "A" }).html, /\/painel\?next=\/painel\/produtos/);
  assert.match(read("src/app/painel/actions.ts"), /redirect\(safePanelNextPath\(formData\.get\("next"\)\) \?\? "\/painel\/loja"\)/);
});

test("titular exclui o rascunho na hora, nunca uma loja publicada ou com pagamento aberto", () => {
  const action = read("src/app/painel/(app)/privacidade/draft-actions.ts");
  assert.match(action, /tenant\.status !== "rascunho"/);
  assert.match(action, /parsed\.data\.confirmation !== tenant\.nome_loja\.trim\(\)/);
  assert.match(action, /intent\.status === "pendente"/);
  assert.match(action, /\.delete\(\)\s*\.eq\("id", tenant\.id\)\s*\.eq\("status", "rascunho"\)/);
  assert.match(action, /auth\.admin\.deleteUser\(tenant\.owner_user_id\)/);
  // Ordem: fotos → loja → usuário.
  const order = ["bucket.remove(", "from(\"tenants\")", "deleteUser("].map((part) => action.indexOf(part));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(read("src/components/painel/data-privacy-management.tsx"), /tenantStatus === "rascunho" && !demo \? <DraftStoreDeletion/);
});

test("crédito do rodapé continua igual e só mede o clique por loja", () => {
  const footer = read("src/components/loja-publica/store-footer.tsx");
  assert.match(footer, /<span>Criado com<\/span>\s*<BrandCredit analyticsSlug=\{analyticsSlug\} \/>/);
  const credit = read("src/components/loja-publica/brand-credit.tsx");
  assert.match(credit, /trackProductMetric\("store_brand_clicked", analyticsSlug\)/);
  assert.match(credit, />\s*ClickCatálogo\s*</);
  assert.match(read("src/app/api/analytics/route.ts"), /TENANT_EVENTS = new Set\(\[[^\]]*"store_brand_clicked"/);
  // A prévia do painel não conta cliques.
  assert.match(read("src/components/loja-publica/store-preview.tsx"), /analyticsSlug=\{!framed \? catalog\.slug : undefined\}\s*\n\s*instagram/);
});
