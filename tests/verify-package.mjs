import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";

const sourceHostingUrl = new URL("../.openai/hosting.json", import.meta.url);
const packagedHostingUrl = new URL("../dist/.openai/hosting.json", import.meta.url);
const sourceDrizzleUrl = new URL("../drizzle/", import.meta.url);
const packagedDrizzleUrl = new URL("../dist/.openai/drizzle/", import.meta.url);

const [sourceHosting, packagedHosting] = await Promise.all([
  readFile(sourceHostingUrl, "utf8"),
  readFile(packagedHostingUrl, "utf8"),
]);

assert.deepEqual(JSON.parse(packagedHosting), JSON.parse(sourceHosting));
assert.equal(JSON.parse(packagedHosting).d1, "DB");

async function listFiles(directoryUrl, prefix = "") {
  const entries = await readdir(directoryUrl, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = `${prefix}${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...await listFiles(new URL(`${entry.name}/`, directoryUrl), `${relativePath}/`));
    } else {
      files.push(relativePath);
    }
  }

  return files;
}

const sourceFiles = await listFiles(sourceDrizzleUrl);
const packagedFiles = await listFiles(packagedDrizzleUrl);
assert.deepEqual(packagedFiles, sourceFiles);

for (const relativePath of sourceFiles) {
  const [source, packaged] = await Promise.all([
    readFile(new URL(relativePath, sourceDrizzleUrl)),
    readFile(new URL(relativePath, packagedDrizzleUrl)),
  ]);
  assert.deepEqual(packaged, source, `Packaged migration differs from source: ${relativePath}`);
}

console.log(`Verified hosting binding and ${sourceFiles.length} packaged migration files.`);
