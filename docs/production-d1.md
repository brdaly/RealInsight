# Production D1 release runbook

RealInsight uses the OpenAI Sites D1 binding named `DB`. The generated
`dist/server/wrangler.json` contains local scaffolding and is not an
authoritative production database target. Never use its generic database name
or placeholder identifier for a production operation.

## Release gates

1. Keep `REALINSIGHT_AI_ENABLED=false` and do not add production secrets.
2. Confirm the exact Sites project and its live `DB` binding through the Sites
   control plane.
3. Record only the production schema and table row counts. Do not export or log
   legacy listing or buyer contents.
4. Build the exact Git commit and run `pnpm verify:package`. The packaged
   hosting metadata and every migration file must byte-match source.
5. Save the new Sites version without deploying it. Record the source commit
   and the prior live Sites version for code rollback.
6. Deploy the code that no longer creates legacy storage before allowing any
   traffic path that could use D1.
7. Apply only the reviewed cleanup migration
   `drizzle/0003_remove_legacy_storage.sql`. Do not replay migrations
   `0000`-`0002` against an existing production database unless the Sites
   migration journal explicitly requires and safely supports that path.
8. Verify that `buyer_profiles`, `listings`, and `evaluations` are absent;
   `evaluation_requests` and its composite index remain; and the retained row
   count has not changed.
9. Run a synthetic deterministic evaluation and the privacy-page smoke test.
   Confirm the response reports `persistence: "not_saved"` and the rate-limit
   table remains unchanged while AI is disabled.

## Stop and rollback

Stop on an unresolved D1 binding, unexpected schema or counts, a package
verification mismatch, a failed deterministic smoke test, or a retained-row
count change.

Before database cleanup, rollback means redeploying the prior Sites version.
After a successful cleanup, prefer a forward fix. Never redeploy code that can
recreate the legacy tables while AI is enabled. The legacy-table drops are a
deliberate privacy cleanup and should be treated as irreversible unless the
hosting control plane provides and verifies an independent database restore.
