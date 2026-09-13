/**
 * Module resolution hooks that let the tests import application modules
 * unchanged.
 *
 * Three things in the application tree Node cannot resolve on its own:
 *
 *   `@/...`               a tsconfig path alias, which Node does not read
 *   extensionless paths   bundler-style imports such as `./openai-config`
 *   `cloudflare:workers`  a Workers runtime built-in
 *
 * Mapping them here means the route under test is the same file that ships,
 * imported by its real specifier, rather than a copy kept in step by hand.
 * Resolution is only widened where Node would otherwise fail, so a genuinely
 * missing module still reports as missing.
 */
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = new URL("../../", import.meta.url);
const WORKERS_STUB = new URL("./cloudflare-workers.mjs", import.meta.url).href;
const EXTENSIONS = [".ts", ".tsx", ".mjs", ".js", "/index.ts", "/index.mjs"];

function isFile(url) {
  return statSync(fileURLToPath(url), { throwIfNoEntry: false })?.isFile() === true;
}

function withExtension(base) {
  if (isFile(base)) return base.href;
  for (const extension of EXTENSIONS) {
    const candidate = new URL(base.href + extension);
    if (isFile(candidate)) return candidate.href;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") {
    return nextResolve(WORKERS_STUB, context);
  }

  if (specifier.startsWith("@/")) {
    const resolved = withExtension(new URL(specifier.slice(2), ROOT));
    if (!resolved) throw new Error(`Test loader could not resolve "${specifier}" under ${ROOT.href}`);
    return nextResolve(resolved, context);
  }

  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    // Bundler-style relative imports omit the extension; Node requires it.
    if (specifier.startsWith(".") && context.parentURL) {
      const resolved = withExtension(new URL(specifier, context.parentURL));
      if (resolved) return nextResolve(resolved, context);
    }
    throw error;
  }
}
