import assert from "node:assert/strict";
import test from "node:test";

import {
  createSignupRecoveryToken,
  hashSignupRecoveryToken,
} from "../src/lib/signup/recovery-token";

test("token de recuperação tem alta entropia e banco recebe somente hash", () => {
  const first = createSignupRecoveryToken();
  const second = createSignupRecoveryToken();
  assert.notEqual(first.raw, second.raw);
  assert.match(first.raw, /^[A-Za-z0-9_-]{40,60}$/);
  assert.match(first.hash, /^[a-f0-9]{64}$/);
  assert.equal(first.hash, hashSignupRecoveryToken(first.raw));
  assert.notEqual(first.hash, first.raw);
});
