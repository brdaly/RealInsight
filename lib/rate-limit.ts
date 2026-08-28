import { env } from "cloudflare:workers";
import { getReadyDb } from "@/db";
import {
  CLAIM_EVALUATION_REQUEST_SQL,
  DAILY_USAGE_SQL,
  DELETE_STALE_REQUESTS_SQL,
  EVALUATION_LIMIT,
  EVALUATION_WINDOW_MS,
  getRateLimitIdentity,
  keyedHash,
  positiveInteger,
} from "./rate-limit-core.mjs";

export async function claimEvaluationRequest(request: Request, visitorSessionId: string, hashSecret: string) {
  await getReadyDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - EVALUATION_WINDOW_MS).toISOString();
  const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const dailyLimit = positiveInteger(process.env.REALINSIGHT_DAILY_AI_CALL_LIMIT, 500);
  const identityHash = await keyedHash(
    hashSecret,
    `realinsight-evaluation:v2:${getRateLimitIdentity(request, visitorSessionId)}`,
  );

  await env.DB.prepare(DELETE_STALE_REQUESTS_SQL).bind(stale).run();

  const insertResult = env.DB.prepare(CLAIM_EVALUATION_REQUEST_SQL).bind(
    identityHash,
    now.toISOString(),
    stale,
    dailyLimit,
    identityHash,
    cutoff,
    EVALUATION_LIMIT,
  ).first() as Promise<{ id: number } | null>;
  const inserted = await insertResult;

  if (inserted) {
    return { allowed: true, retryAfterSeconds: 0, scope: "none" as const };
  }

  const dailyUsageResult = env.DB.prepare(DAILY_USAGE_SQL).bind(stale).first() as Promise<{ value: number } | null>;
  const dailyUsage = await dailyUsageResult;
  return Number(dailyUsage?.value ?? 0) >= dailyLimit
    ? { allowed: false, retryAfterSeconds: 3_600, scope: "global" as const }
    : { allowed: false, retryAfterSeconds: Math.ceil(EVALUATION_WINDOW_MS / 1000), scope: "visitor" as const };
}
