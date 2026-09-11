import assert from "node:assert/strict";
import test from "node:test";

import {
  formatCurrencyInput,
  parseBrazilianCurrency,
} from "../src/lib/format/currency";

test("formata dígitos como moeda brasileira", () => {
  assert.equal(formatCurrencyInput("123456"), "R$ 1.234,56");
  assert.equal(formatCurrencyInput("5"), "R$ 0,05");
  assert.equal(formatCurrencyInput(""), "");
});

test("interpreta formatos aceitos sem usar ponto flutuante ambíguo", () => {
  assert.equal(parseBrazilianCurrency("R$ 1.234,56"), 1234.56);
  assert.equal(parseBrazilianCurrency("12,99"), 12.99);
  assert.equal(parseBrazilianCurrency("12.99"), 12.99);
  assert.equal(parseBrazilianCurrency("1.234"), 1234);
  assert.equal(Number.isNaN(parseBrazilianCurrency("12,999")), true);
  assert.equal(Number.isNaN(parseBrazilianCurrency("-1,00")), true);
});
