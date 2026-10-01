import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  deliveryModeText,
  hasStoreServiceInfo,
  normalizePaymentMethods,
  paymentMethodsText,
  storeServiceSummary,
} from "../src/lib/catalog/store-info";
import { createCartMessage } from "../src/lib/whatsapp/cart-message";

const read = (path: string) => readFileSync(path, "utf8");
const product = (nome: string, preco: number) => ({ descricao: null, id: nome, imagem_url: null, nome, ordem: 0, preco, variacao_info: null });

test("formas de pagamento seguem ordem canônica e descartam valores desconhecidos", () => {
  assert.deepEqual(normalizePaymentMethods(["dinheiro", "pix", "boleto", "pix"]), ["pix", "dinheiro"]);
  assert.equal(paymentMethodsText(["dinheiro", "credito", "pix"]), "Pix, cartão de crédito ou dinheiro");
  assert.equal(paymentMethodsText(["pix"]), "Pix");
  assert.equal(paymentMethodsText([]), null);
  assert.equal(deliveryModeText("ambos"), "Entrega e retirada");
  assert.equal(deliveryModeText(null), null);
});

test("resumo do carrinho só aparece quando a loja informou algo", () => {
  const empty = { entrega_modo: null, entrega_observacao: null, formas_pagamento: [], horario_atendimento: null };
  assert.equal(hasStoreServiceInfo(empty), false);
  assert.equal(storeServiceSummary(empty), null);
  assert.equal(hasStoreServiceInfo({ ...empty, horario_atendimento: "Seg a sex" }), true);
  assert.equal(
    storeServiceSummary({ ...empty, entrega_modo: "retirada", formas_pagamento: ["pix", "debito"] }),
    "Pagamento: Pix ou cartão de débito · Retirada no local",
  );
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

test("painel mostra o desempenho da própria loja sem expor a tabela de métricas", () => {
  const stats = read("src/lib/analytics/store-stats.ts");
  const page = read("src/app/painel/(app)/loja/page.tsx");
  assert.match(stats, /\.eq\("scope_key", tenantId\)/);
  assert.match(stats, /import "server-only"/);
  assert.match(page, /getStoreWeeklyStats\(tenant\.id\)/);
  assert.match(page, /<StoreWeeklyStats demo stats=\{\[\.\.\.DEMO_STORE_STATS\]\} \/>/);
});
