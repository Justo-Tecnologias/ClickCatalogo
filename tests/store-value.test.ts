import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deliveryModeText,
  hasStoreServiceInfo,
  normalizePaymentMethods,
} from "../src/lib/catalog/store-info";
import { createCartMessage } from "../src/lib/whatsapp/cart-message";

const read = (path: string) => readFileSync(path, "utf8");
const product = (nome: string, preco: number) => ({ descricao: null, id: nome, imagem_url: null, nome, ordem: 0, preco, variacao_info: null });

test("formas de pagamento seguem ordem canônica e descartam valores desconhecidos", () => {
  assert.deepEqual(normalizePaymentMethods(["dinheiro", "pix", "boleto", "pix"]), ["pix", "dinheiro"]);
  assert.equal(deliveryModeText("ambos"), "Entrega e retirada");
  assert.equal(deliveryModeText(null), null);
});

test("selos de atendimento só aparecem quando a loja informou algo", () => {
  const empty = { entrega_modo: null, entrega_observacao: null, formas_pagamento: [], horario_atendimento: null };
  assert.equal(hasStoreServiceInfo(empty), false);
  assert.equal(hasStoreServiceInfo({ ...empty, horario_atendimento: "Seg a sex" }), true);
  assert.equal(hasStoreServiceInfo({ ...empty, formas_pagamento: ["pix"] }), true);
});

test("atendimento fica no rodapé da loja, não no topo", () => {
  const preview = read("src/components/loja-publica/store-preview.tsx");
  assert.doesNotMatch(preview, /StoreServiceInfo/);
  assert.match(preview, /serviceInfo=\{catalog\}/);
  assert.match(read("src/components/loja-publica/store-footer.tsx"), /<StoreServiceInfoList/);
});

test("mensagem do pedido inclui só os detalhes preenchidos, em uma linha cada", () => {
  const items = [{ product: product("Vela Aurora", 42), quantity: 2 }];
  assert.doesNotMatch(createCartMessage("Loja", items), /Nome:|Recebimento:|Pagamento:|Observação:/);

  const message = createCartMessage("Loja", items, {
    customerName: "  Ana \n Souza ",
    note: "Para presente,\n\npor favor",
    payment: "pix",
    receiving: "retirada",
  });
  assert.match(message, /Total do pedido: R\$\s84,00\n\nNome: Ana Souza\nRecebimento: Retirada no local\nPagamento: Pix\nObservação: Para presente, por favor$/);
  assert.equal(createCartMessage("Loja", items, { customerName: "x".repeat(200) }).match(/Nome: (x+)/)?.[1].length, 60);
});

test("carrinho guarda os detalhes só em memória e oferece escolhas conforme a loja", () => {
  const cart = read("src/components/loja-publica/cart-panel.tsx");
  assert.doesNotMatch(cart, /localStorage|sessionStorage|trackProductMetric\([^)]*customerName/);
  assert.match(cart, /offersReceivingChoice = serviceInfo\?\.entrega_modo === "ambos"/);
  assert.match(cart, /acceptedPayments\.length > 1 \? payment : null/);
});

test("carrinho tem duas etapas e só repete no atendimento o que não virou escolha", () => {
  const cart = read("src/components/loja-publica/cart-panel.tsx");
  assert.match(cart, /type CartStep = "finalizar" \| "itens"/);
  assert.match(cart, /Finalizar pedido/);
  assert.match(cart, /onClick=\{\(\) => goTo\("finalizar"\)\}/);
  assert.match(cart, /acceptedPayments\.length === 1/);
  assert.match(cart, /serviceInfo\?\.entrega_modo && !offersReceivingChoice/);
  // O link do WhatsApp só aparece na etapa de finalização.
  const itemsStep = cart.slice(cart.lastIndexOf(") : ("), cart.indexOf("const CART_INPUT_CLASS"));
  assert.match(itemsStep, /Continuar/);
  assert.doesNotMatch(itemsStep, /orderUrl/);
});

test("servidor valida as informações de atendimento antes de gravar", () => {
  const action = read("src/app/painel/(app)/loja/actions.ts");
  assert.match(action, /formasPagamento: z\.array\(z\.enum\(PAYMENT_METHODS/);
  assert.match(action, /entregaModo: z\.enum\(DELIVERY_MODES/);
  assert.match(action, /entrega_observacao: parsed\.data\.entregaModo \? parsed\.data\.entregaObservacao : null/);
});

test("banco aceita somente os valores das opções e o titular edita as colunas novas", () => {
  const schema = read("supabase/schema.sql").toLowerCase();
  const migration = read("supabase/migrations/202610010027_store_service_info.sql").toLowerCase();
  for (const sql of [schema, migration]) {
    assert.match(sql, /formas_pagamento <@ array\['pix', 'credito', 'debito', 'dinheiro'\]::text\[\]/);
    assert.match(sql, /entrega_modo in \('entrega', 'retirada', 'ambos'\)/);
    assert.match(sql, /'formas_pagamento', to_jsonb\(tenant\.formas_pagamento\)/);
    assert.match(sql, /'horario_atendimento', tenant\.horario_atendimento/);
    const grant = sql.match(/grant update \(([^)]*)\) on table public\.tenants to authenticated/)?.[1] ?? "";
    for (const column of ["formas_pagamento", "entrega_modo", "entrega_observacao", "horario_atendimento"]) assert.match(grant, new RegExp(column));
    assert.doesNotMatch(grant, /\bslug\b/);
  }
});

test("topo só com banner: opcional, exige banner e mantém o nome para leitores de tela", () => {
  const header = read("src/components/loja-publica/store-header.tsx");
  assert.match(header, /if \(bannerOnly && bannerUrl\)/);
  assert.match(header, /<Heading className="sr-only">\{storeName\}<\/Heading>/);
  assert.match(read("src/app/painel/(app)/loja/actions.ts"), /banner_somente: formData\.get\("bannerSomente"\) === "on" && Boolean\(bannerUrl\)/);
  assert.match(read("src/lib/catalog/public-catalog.ts"), /banner_somente: z\.boolean\(\)\.nullable\(\)\.optional\(\)\.default\(false\)/);
  const schema = read("supabase/schema.sql").toLowerCase();
  const migration = read("supabase/migrations/202610010028_banner_only_header.sql").toLowerCase();
  assert.match(schema, /banner_somente boolean not null default false/);
  assert.match(migration, /add column if not exists banner_somente boolean not null default false/);
  for (const sql of [schema, migration]) {
    assert.match(sql, /'banner_somente', tenant\.banner_somente/);
    const grant = sql.match(/grant update \(([^)]*)\) on table public\.tenants to authenticated/)?.[1] ?? "";
    for (const column of ["banner_somente", "formas_pagamento", "horario_atendimento", "nome_loja"]) assert.match(grant, new RegExp(column));
    assert.doesNotMatch(grant, /\bslug\b/);
  }
});

test("configuração da loja em abas que enviam todos os campos juntos", () => {
  const form = read("src/components/painel/store-settings-form.tsx");
  for (const tab of ["loja", "contato", "atendimento", "aparencia"]) assert.match(form, new RegExp(`tab="${tab}"`));
  // Abas escondidas ficam no DOM (hidden) para o "Salvar" enviar tudo.
  assert.match(form, /hidden=\{activeTab !== tab\}/);
  // Campo inválido em outra aba: abre a aba antes de mostrar o erro.
  assert.match(form, /noValidate/);
  assert.match(form, /flushSync\(\(\) => setActiveTab\(tab\)\)/);
});

test("login foca em entrar e separa os problemas de acesso em outra tela", () => {
  const login = read("src/app/painel/page.tsx") + read("src/components/painel/login-form.tsx");
  assert.match(login, /href="\/painel\/problemas-para-entrar"/);
  assert.doesNotMatch(login, /href="\/painel\/acessar-loja"|href="\/painel\/recuperar-senha"/);
  assert.match(login, /href="\/cadastro"/);
  assert.match(login, /startDemoAction/);
  const help = read("src/app/painel/problemas-para-entrar/page.tsx");
  for (const href of ["/painel/recuperar-senha", "/painel/acessar-loja", "/atendimento"]) assert.match(help, new RegExp(`href="${href}"`));
});

test("painel mostra o desempenho da própria loja sem expor a tabela de métricas", () => {
  const stats = read("src/lib/analytics/store-stats.ts");
  const page = read("src/app/painel/(app)/loja/page.tsx");
  assert.match(stats, /\.eq\("scope_key", tenantId\)/);
  assert.match(stats, /import "server-only"/);
  assert.match(page, /getStoreWeeklyStats\(tenant\.id\)/);
  assert.match(page, /<StoreWeeklyStats demo stats=\{\[\.\.\.DEMO_STORE_STATS\]\} \/>/);
});
