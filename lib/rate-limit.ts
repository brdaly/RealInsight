import { and, count, eq, gte, lt } from "drizzle-orm";
import { getReadyDb } from "@/db";
import { evaluationRequests } from "@/db/schema";
import { EVALUATION_LIMIT, EVALUATION_WINDOW_MS, getRateLimitIdentity } from "./rate-limit-core.mjs";

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function claimEvaluationRequest(request: Request, visitorSessionId: string) {
  const db = await getReadyDb();
  const now = new Date();
  const cutoff = new Date(now.getTime() - EVALUATION_WINDOW_MS).toISOString();
  const stale = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const dailyLimit = Math.max(1, Number(process.env.REALINSIGHT_DAILY_AI_CALL_LIMIT ?? 500));
  const [dailyUsage] = await db
    .select({ value: count() })
    .from(evaluationRequests)
    .where(gte(evaluationRequests.createdAt, stale));
  if (Number(dailyUsage?.value ?? 0) >= dailyLimit) {
    return { allowed: false, retryAfterSeconds: 3_600, scope: "global" as const };
  }
  const identityHash = await sha256(`realinsight-evaluation:v1:${getRateLimitIdentity(request, visitorSessionId)}`);
  const [usage] = await db
    .select({ value: count() })
    .from(evaluationRequests)
    .where(and(
      eq(evaluationRequests.identityHash, identityHash),
      gte(evaluationRequests.createdAt, cutoff),
    ));

  if (Number(usage?.value ?? 0) >= EVALUATION_LIMIT) {
    return { allowed: false, retryAfterSeconds: Math.ceil(EVALUATION_WINDOW_MS / 1000), scope: "visitor" as const };
  }

  await db.insert(evaluationRequests).values({ identityHash, createdAt: now.toISOString() });
  await db.delete(evaluationRequests).where(lt(evaluationRequests.createdAt, stale));
  return { allowed: true, retryAfterSeconds: 0, scope: "none" as const };
}
