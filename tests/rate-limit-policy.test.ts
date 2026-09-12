import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const rateLimitPath = new URL("../src/lib/security/rate-limit.ts", import.meta.url);

test("operações públicas sensíveis falham fechadas sem o limitador distribuído", async () => {
  const source = await readFile(rateLimitPath, "utf8");
  for (const policy of [
    "checkout",
    "passwordSetup",
    "signupRecoveryConsume",
    "signupRecoveryEmail",
    "signupRecoveryIp",
  ]) {
    assert.match(source, new RegExp(`${policy}: \\{ failureMode: "closed"`));
  }

  assert.doesNotMatch(source, /webhook: \{ failureMode: "closed"/);
  assert.match(source, /if \(policy\.failureMode === "closed"\) return unavailableRateLimitResponse\(\)/);
});
