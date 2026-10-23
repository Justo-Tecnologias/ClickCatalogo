import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseShowcaseNiche } from "../src/lib/marketing/store-showcase";

const read = (path: string) => readFileSync(path, "utf8");
const migration = read("supabase/migrations/202610230033_example_products.sql");

test("nicho dos produtos de exemplo só aceita a lista fechada", () => {
  assert.equal(parseShowcaseNiche("doces"), "doces");
  for (const value of ["", "Doces", "constructor", "__proto__", null, 1, undefined]) {
    assert.equal(parseShowcaseNiche(value), null);
  }
});

test("coluna exemplo existe e os lembretes não contam exemplos", () => {
  for (const sql of [migration, read("supabase/schema.sql")]) {
    assert.match(sql, /exemplo boolean not null default false/);
    const reminders = sql.slice(sql.indexOf("create or replace function public.claim_draft_reminders"));
    assert.match(reminders.slice(0, reminders.indexOf("$$;")), /and product\.ativo = true\s+and product\.exemplo = false/);
  }
  assert.match(migration, /grant execute on function public\.claim_draft_reminders\(integer\) to service_role;/);
});

test("cadastro vindo da prévia cria os exemplos sem desfazer a conta se falhar", () => {
  const route = read("src/app/api/cadastro/criar/route.ts");
  assert.match(route, /const exampleNiche = parseShowcaseNiche\(/);
  assert.match(route, /await seedExampleCatalog\(admin, tenant\.id, exampleNiche\)\s*\n\s*\.catch\(\(seedError\) => logError\("draft_signup\.example_products"/);
  const seed = read("src/lib/signup/example-catalog.ts");
  assert.match(seed, /exemplo: true,/);
  assert.match(read("src/components/cadastro/signup-form.tsx"), /produtosExemplo: exampleNiche && useExamples \? exampleNiche : null/);
  assert.match(read("src/app/cadastro/page.tsx"), /nicho: parseShowcaseNiche\(firstParam\(params\.nicho\)\)/);
});

test("exemplos não contam como produtos do titular e bloqueiam a publicação", () => {
  const actions = read("src/app/painel/(app)/produtos/actions.ts");
  assert.match(actions, /exemplo: false,\s*\n\s*imagem_url: imageUrl,/);
  assert.match(actions, /\.eq\("tenant_id", tenant\.id\)\.eq\("exemplo", false\),\s*\n\s*\]\);/);
  assert.match(actions, /\.delete\(\)\.eq\("tenant_id", tenant\.id\)\.eq\("exemplo", true\)/);
  const publish = read("src/app/painel/(app)/loja/publish-actions.ts");
  assert.match(publish, /if \(\(exampleCount \?\? 0\) > 0\) \{\s*\n\s*return \{ blocker: "examples"/);
  assert.match(publish, /\.eq\("ativo", true\)\.eq\("exemplo", false\)/);
  assert.match(read("src/components/painel/draft-banner.tsx"), /const hasProducts = productCount > 0 && exampleCount === 0;/);
  assert.match(read("src/app/painel/(app)/layout.tsx"), /\.eq\("ativo", true\)\.eq\("exemplo", false\)/);
});
