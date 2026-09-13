/**
 * Stand-in for the `cloudflare:workers` built-in, which only exists inside the
 * Workers runtime. `tests/support/loader.mjs` resolves that specifier here so
 * modules reaching for the binding can be imported and executed under
 * `node --test`.
 *
 * `env` is a live binding, so assigning `env.DB` from a test is visible to
 * everything that already imported it.
 */
export const env = {
  /** @type {unknown} */
  DB: null,
};

/** Restores the default (no binding) state between tests. */
export function resetEnv() {
  env.DB = null;
}
