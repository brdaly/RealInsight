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
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { stat } from "node:fs/promises";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ASSETS = ["og.png", "social-preview.jpg"];
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
  // Needs the production build. `pnpm test` runs it first; running `test:unit`
  // on its own does not, and a missing build should read as "not run" rather
  // than as a failure of the thing under test.
  const built = await stat(new URL("../dist", import.meta.url)).catch(() => null);
  if (!built?.isDirectory()) {
    t.skip("no production build present; run `pnpm run build` first");
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

    assert.equal(
      response.headers.get("X-Content-Type-Options"),
      "nosniff",
      `${name} should still carry the security headers`,
    );
  }
});
