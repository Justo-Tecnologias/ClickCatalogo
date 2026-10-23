import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { currentAcquisitionOrigin } from "../src/lib/analytics/client";
import { publicProductMetricNames } from "../src/lib/analytics/events";
import {
  acquisitionMetricNames,
  acquisitionOriginNames,
  parseAcquisitionOrigin,
} from "../src/lib/analytics/origins";

const read = (path: string) => readFileSync(path, "utf8");
const migration = "supabase/migrations/202610220031_acquisition_origin_metrics.sql";

test("só canais da lista fechada são aceitos", () => {
  assert.equal(parseAcquisitionOrigin("bio"), "bio");
  assert.equal(parseAcquisitionOrigin(" DM "), "dm");
  for (const value of ["", "instagram", "bio;drop", "constructor", "__proto__", null, 42, undefined]) {
    assert.equal(parseAcquisitionOrigin(value), null);
  }
  for (const origin of acquisitionOriginNames) assert.match(origin, /^[a-z0-9-]{2,24}$/);
});

test("lista de etapas por canal é igual no código, na migration e no schema", () => {
  const expected = [...acquisitionMetricNames].sort();
  for (const sql of [read(migration), read("supabase/schema.sql")]) {
    const constraint = sql.match(/acquisition_metrics_daily_event_check check \(\s*event_name in \(([^)]*)\)/);
    const fn = sql.match(/increment_acquisition_metric[\s\S]*?if p_event_name not in \(([^)]*)\)/);
    assert.ok(constraint && fn);
    for (const list of [constraint[1], fn[1]]) {
      assert.deepEqual([...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]).sort(), expected);
    }
    assert.match(sql, /grant execute on function public\.increment_acquisition_metric\(text, text\)\s+to service_role;/);
    assert.match(sql, /revoke all on table public\.acquisition_metrics_daily from public, anon, authenticated;/);
  }
  // Etapas enviadas pelo navegador precisam existir na API pública.
  for (const event of acquisitionMetricNames.filter((name) => name !== "draft_created")) {
    assert.ok((publicProductMetricNames as readonly string[]).includes(event));
  }
});

test("canal vem da URL, fica só na aba e o último link vale", () => {
  const storage = new Map<string, string>();
  const fakeWindow = {
    location: { search: "?origem=Bio" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => void storage.set(key, value),
    },
  };
  Object.assign(globalThis, { window: fakeWindow });
  try {
    assert.equal(currentAcquisitionOrigin(), "bio");
    fakeWindow.location.search = "";
    assert.equal(currentAcquisitionOrigin(), "bio");
    fakeWindow.location.search = "?origem=dm";
    assert.equal(currentAcquisitionOrigin(), "dm");
    fakeWindow.location.search = "?origem=inventado";
    assert.equal(currentAcquisitionOrigin(), "dm");
  } finally {
    Reflect.deleteProperty(globalThis, "window");
  }
  assert.equal(currentAcquisitionOrigin(), null);
});

test("eventos de loja não são atribuídos a canal", () => {
  assert.match(read("src/lib/analytics/client.ts"), /const origem = slug \? undefined : currentAcquisitionOrigin\(\)/);
  assert.match(read("src/app/api/analytics/route.ts"), /if \(!tenantId && origin && isAcquisitionMetric\(parsed\.data\.event\)\)/);
});

test("loja criada guarda o canal e o titular não pode alterá-lo", () => {
  const route = read("src/app/api/cadastro/criar/route.ts");
  assert.match(route, /origem_cadastro: origin,/);
  assert.match(route, /if \(origin\) await recordAcquisitionMetric\("draft_created", origin\);/);
  assert.match(read("src/components/cadastro/signup-form.tsx"), /origem: currentAcquisitionOrigin\(\)/);
  for (const sql of [read(migration), read("supabase/schema.sql")]) {
    assert.match(sql, /origem_cadastro is null or origem_cadastro ~ '\^\[a-z0-9-\]\{2,24\}\$'/);
  }
  const grant = read("supabase/schema.sql").match(/grant update \(([^)]*)\) on table public\.tenants to authenticated/);
  assert.ok(grant);
  assert.ok(!grant[1].includes("origem_cadastro"));
});

test("crédito do rodapé leva a etiqueta da loja e a política explica a etiqueta", () => {
  assert.match(read("src/components/loja-publica/brand-credit.tsx"), /href="\/\?origem=loja"/);
  const privacy = read("src/app/privacidade/page.tsx");
  assert.match(privacy, /updatedAt="22 de outubro de 2026"/);
  assert.match(privacy, /essa etiqueta fica guardada apenas na aba aberta/);
  assert.match(read("src/lib/legal/documents.ts"), /PRIVACY_VERSION = "2026-10-22"/);
});
