import assert from "node:assert/strict";
import test from "node:test";
import { pairCode, parseBearer, parseMoney, safeEqualText } from "../src/security.js";

test("parseMoney converts decimal strings to integer hundredths", () => {
  assert.equal(parseMoney("12"), 1200);
  assert.equal(parseMoney("12,3"), 1230);
  assert.equal(parseMoney("0.01"), 1);
  for (const invalid of ["0", "-1", "1.234", "1e2", "abc", "10000000000.01"]) assert.equal(parseMoney(invalid), null);
});

test("pair codes have fixed numeric format", () => assert.match(pairCode(), /^\d{8}$/));
test("bearer parser is strict", () => {
  const token = "a".repeat(43);
  assert.equal(parseBearer(`Bearer ${token}`), token);
  assert.equal(parseBearer(`bearer ${token}`), null);
  assert.equal(parseBearer("Bearer short"), null);
});
test("secret comparison handles missing and unequal values", () => {
  assert.equal(safeEqualText("same", "same"), true);
  assert.equal(safeEqualText("no", "same"), false);
  assert.equal(safeEqualText(undefined, "same"), false);
});
