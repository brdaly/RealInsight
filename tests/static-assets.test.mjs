/**
 * End-to-end check that static assets are served whole.
 *
 * This exists because a unit test could not catch the bug it guards. The first
 * version of `withSecurityHeaders` rebuilt every response as
 * `new Response(response.body, …)`. Against a synthetic in-memory
 * `ReadableStream` that is harmless, and the unit tests in
 * `security-headers.test.mjs` pass against both the broken and the fixed
 * implementation. Against the file-backed stream the asset layer actually
 * returns, the body detaches from the response that owns it and closes before
 * it is read: `/og.png` and `/social-preview.jpg` served HTTP 200 with zero
 * bytes under `pnpm start`.
 *
 * Only a real request to a real server distinguishes the two, so that is what
 * this does. It relies on `pnpm test` having run the build first.
 *
 * Scope, because the name promises more than it proves: this runs against
 * `vinext start`, which routes `public/` files through the Worker. Deployed on
 * Cloudflare the asset layer answers them first, so the header assertion below
 * holds here and not in production. It is kept because the body assertion is
 * the regression guard, and that one is runtime-independent. Header coverage in
 * the deployment has to be checked against
 * `wrangler dev --config dist/server/wrangler.json`.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readdir, stat } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ASSETS = ["og.png", "social-preview.jpg"];
/** Source trees whose changes invalidate the build. */
const SOURCE_DIRS = ["app", "lib", "worker", "db"];

/**
 * Why the build cannot be trusted, or null when it is current.
 *
 * Compares the build's own timestamp against the newest source file. A
 * directory check alone is not enough: an `dist/` left over from an earlier
 * checkout looks exactly like a fresh one and turns this test into a coin toss.
 *
 * @param {URL} root
 * @returns {Promise<string | null>}
 */
async function buildStaleness(root) {
  const built = await stat(new URL("dist", root)).catch(() => null);
  if (!built?.isDirectory()) return "no production build present";

  let newestSource = 0;
  let newestPath = "";
  for (const dir of SOURCE_DIRS) {
    const base = new URL(`${dir}/`, root);
    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true, recursive: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const path = new URL(`${entry.parentPath ?? base.pathname}/${entry.name}`.replace(/\/+/g, "/"), "file:");
      const info = await stat(path).catch(() => null);
      if (info && info.mtimeMs > newestSource) {
        newestSource = info.mtimeMs;
        newestPath = `${dir}/${entry.name}`;
      }
    }
  }

  return newestSource > built.mtimeMs
    ? `the build predates ${newestPath}, so it does not contain the current source`
    : null;
}

const START_TIMEOUT_MS = 60_000;

async function freePort() {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  server.close();
  await once(server, "close");
  return port;
}

async function waitForServer(origin, deadline) {
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/`, { signal: AbortSignal.timeout(2_000) });
      if (response.ok || response.status < 500) {
        await response.arrayBuffer();
        return true;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

test("static assets are served with their full bodies and the security headers", async (t) => {
  // Needs a build of THIS source. `pnpm test` builds first; `test:unit` alone
  // does not. A missing or stale build must read as "not run" rather than as a
  // result, in either direction: a stale build reports a fixed regression as
  // still broken, and just as easily reports a live one as fixed.
  const staleness = await buildStaleness(new URL("..", import.meta.url));
  if (staleness) {
    t.skip(`${staleness}; run \`pnpm run build\` first`);
    return;
  }

  const port = await freePort();
  const origin = `http://127.0.0.1:${port}`;
  const server = spawn(fileURLToPath(new URL("../node_modules/.bin/vinext", import.meta.url)), ["start"], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });

  t.after(async () => {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 5_000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
  });

  const ready = await waitForServer(origin, Date.now() + START_TIMEOUT_MS);
  assert.ok(ready, `production server did not start within ${START_TIMEOUT_MS}ms:\n${output}`);

  for (const name of ASSETS) {
    const onDisk = await stat(new URL(`../public/${name}`, import.meta.url));
    const response = await fetch(`${origin}/${name}`);

    assert.equal(response.status, 200, `${name} status`);

    const body = await response.arrayBuffer();
    assert.equal(
      body.byteLength,
      onDisk.size,
      `${name} was served ${body.byteLength} bytes but is ${onDisk.size} bytes on disk`,
    );

    // True under `vinext start`, which routes public/ through the Worker. NOT
    // true once deployed, where the asset layer answers first. See the header
    // comment: this asserts the local contract, and the byte-length check above
    // is the part that guards the regression in any runtime.
    assert.equal(
      response.headers.get("X-Content-Type-Options"),
      "nosniff",
      `${name} should carry the security headers under vinext start`,
    );
  }
});
