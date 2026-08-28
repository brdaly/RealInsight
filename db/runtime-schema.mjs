export const EVALUATION_REQUESTS_SCHEMA_SQL = Object.freeze([
  `CREATE TABLE IF NOT EXISTS evaluation_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    identity_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  "CREATE INDEX IF NOT EXISTS evaluation_requests_identity_created_idx ON evaluation_requests(identity_hash, created_at)",
]);

/**
 * Shares concurrent schema initialization while allowing a later request to
 * retry after a transient D1 failure.
 *
 * @param {() => Promise<void>} initialize
 * @returns {() => Promise<void>}
 */
export function createSchemaReadiness(initialize) {
  /** @type {Promise<void> | null} */
  let inFlight = null;

  return async function ensureSchemaReady() {
    inFlight ??= Promise.resolve().then(initialize);

    try {
      await inFlight;
    } catch (error) {
      inFlight = null;
      throw error;
    }
  };
}
