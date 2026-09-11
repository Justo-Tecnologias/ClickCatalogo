import assert from "node:assert/strict";
import test from "node:test";

import { secretsMatch } from "../src/lib/security/secret";

test("token correto do webhook é aceito", () => {
  const token = "9f4a93a8733f97ef6fc9248193241f91";
  assert.equal(secretsMatch(token, token), true);
});

test("token ausente, alterado ou com tamanho diferente é rejeitado", () => {
  const expected = "9f4a93a8733f97ef6fc9248193241f91";

  assert.equal(secretsMatch(null, expected), false);
  assert.equal(secretsMatch(`${expected}x`, expected), false);
  assert.equal(secretsMatch("8f4a93a8733f97ef6fc9248193241f91", expected), false);
});
