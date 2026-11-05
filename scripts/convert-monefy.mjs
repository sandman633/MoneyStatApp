import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { importMonefy } from "../src/monefyImport.ts";

const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw Error("Usage: node --experimental-strip-types scripts/convert-monefy.mjs source.csv destination.json");
if (resolve(source) === resolve(destination)) throw Error("Исходный файл нельзя перезаписывать.");
const contents = await readFile(source);
const result = importMonefy(new TextDecoder("utf-8", { fatal: true }).decode(contents));
// Exclusive create: never overwrite an existing backup.
await writeFile(destination, JSON.stringify(result.state, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ destination: resolve(destination), sourceSHA256: createHash("sha256").update(contents).digest("hex"), ...result.summary }, null, 2));
