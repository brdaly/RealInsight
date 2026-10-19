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
 * This now verifies full asset bodies in the compiled Worker runtime. The
 * historical Node file-stream failure also remains covered by the response
 * identity assertion in `security-headers.test.mjs`. This test relies on
 * `pnpm test` having run the build first.
 *
 * The packaged server is a Cloudflare Worker, including `cloudflare:workers`
 * imports, so it must run under Wrangler rather than Node's `vinext start`.
 * A temporary copy of the generated config routes assets through the Worker
 * to exercise its response wrapper. Production's asset-first routing remains
 * unchanged; this header assertion covers the Worker response contract only.
 */
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const ASSETS = ["og.png", "social-preview.jpg"];
/** Source trees whose changes invalidate the build. */
const SOURCE_DIRS = ["app", "lib", "worker", "db", "build", "public"];

/** Single files that invalidate the build the same way a source tree does. */
const SOURCE_FILES = [
  "vite.config.ts",
  "next.config.ts",
  "postcss.config.mjs",
  "package.json",
  ".openai/hosting.json",
];

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
  const consider = (mtimeMs, label) => {
    if (mtimeMs > newestSource) {
      newestSource = mtimeMs;
      newestPath = label;
    }
  };

  for (const dir of SOURCE_DIRS) {
    const base = new URL(`${dir}/`, root);
    // Directories count, not only files. Deleting or renaming a source file
    // touches the parent directory's mtime and no surviving file's, so a
    // file-only scan calls a checkout that removed source "current" — the
    // original false pass, in the branch-switch case this guard exists for.
    const baseInfo = await stat(base).catch(() => null);
    if (!baseInfo) continue;
    consider(baseInfo.mtimeMs, dir);

    let entries;
    try {
      entries = await readdir(base, { withFileTypes: true, recursive: true });
    } catch {
      continue;
    }
    const baseDir = fileURLToPath(base);
    for (const entry of entries) {
      // Joined as a filesystem path rather than interpolated into a URL. On
      // Windows `parentPath` is `C:\…`, which `new URL(…, "file:")` reads as
      // the scheme `c:`; `stat` then rejects it, the catch swallows every
      // recursive entry, and only the top-level directory mtimes remain.
      // Editing a nested source file changes no directory's mtime, so the
      // guard would call a stale build current — the false pass it exists for.
      const entryPath = path.join(entry.parentPath ?? baseDir, entry.name);
      const info = await stat(entryPath).catch(() => null);
      if (info) consider(info.mtimeMs, path.relative(fileURLToPath(root), entryPath));
    }
  }

  for (const file of SOURCE_FILES) {
    const info = await stat(new URL(file, root)).catch(() => null);
    if (info) consider(info.mtimeMs, file);
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
  const configUrl = new URL(`../dist/server/static-assets-test-${process.pid}.json`, import.meta.url);
  const config = JSON.parse(await readFile(new URL("../dist/server/wrangler.json", import.meta.url), "utf8"));
  config.assets = { ...config.assets, binding: "ASSETS", run_worker_first: true };
  await writeFile(configUrl, JSON.stringify(config));
  t.after(() => rm(configUrl, { force: true }));

  const server = spawn(fileURLToPath(new URL("../node_modules/.bin/wrangler", import.meta.url)), [
    "dev", "--config", fileURLToPath(configUrl), "--local", "--ip", "127.0.0.1",
    "--port", String(port), "--show-interactive-dev-session", "false",
    "--persist-to", `.wrangler/static-assets-test-${process.pid}`,
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      WRANGLER_LOG_PATH: ".wrangler/static-assets-test.log",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });

  t.after(async () => {
    server.kill("SIGTERM");
    await Promise.race([once(server, "exit"), new Promise((r) => setTimeout(r, 5_000))]);
    if (server.exitCode === null) server.kill("SIGKILL");
    await rm(new URL(`../.wrangler/static-assets-test-${process.pid}/`, import.meta.url), {
      force: true,
      recursive: true,
    });
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

    // The test config sends assets through the Worker to exercise its wrapper.
    // Production serves matching assets first, so deployed header coverage
    // must be assessed separately. The full-body assertion applies to both.
    assert.equal(
      response.headers.get("X-Content-Type-Options"),
      "nosniff",
      `${name} should carry the security headers when served through the Worker`,
    );
  }
});
