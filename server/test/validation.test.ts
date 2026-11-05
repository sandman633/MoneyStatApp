import assert from "node:assert/strict";
import test from "node:test";
import { validateAck, validateCatalog } from "../src/validation.js";

const valid = { accounts: [{ id: "a1", name: "Карта", currency: "RUB" }], categories: [{ id: "c1", name: "Еда", kind: "expense" }], currencies: ["RUB"] };

test("catalog accepts the minimal sync projection", () => assert.deepEqual(validateCatalog(valid), valid));
test("catalog rejects duplicate IDs and invalid kinds", () => {
  assert.equal(validateCatalog({ ...valid, categories: [{ id: "a1", name: "Еда", kind: "expense" }] }), null);
  assert.equal(validateCatalog({ ...valid, categories: [{ id: "c1", name: "Еда", kind: "transfer" }] }), null);
  assert.equal(validateCatalog({ ...valid, accounts: [{ id: "a1", name: "Карта", currency: "USD" }] }), null);
});
test("ack validates UUIDs and removes duplicates", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.deepEqual(validateAck({ ids: [id, id] }), [id]);
  assert.equal(validateAck({ ids: ["no"] }), null);
});
