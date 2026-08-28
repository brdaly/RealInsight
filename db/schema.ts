import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const buyerProfiles = sqliteTable("buyer_profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  maxBudget: integer("max_budget").notNull(),
  maxCommuteMinutes: integer("max_commute_minutes").notNull(),
  commuteAnchor: text("commute_anchor").notNull(),
  mustHaves: text("must_haves").notNull(),
  dealBreakers: text("deal_breakers").notNull(),
  amenities: text("amenities").notNull(),
  weights: text("weights").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const listings = sqliteTable("listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  rawText: text("raw_text").notNull(),
  sourceUrl: text("source_url"),
  extracted: text("extracted").notNull(),
  photoUrls: text("photo_urls").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const evaluations = sqliteTable("evaluations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  listingId: integer("listing_id").notNull(),
  buyerProfileId: integer("buyer_profile_id").notNull(),
  visitorSessionId: text("visitor_session_id"),
  photoJson: text("photo_json"),
  scoreJson: text("score_json").notNull(),
  totalScore: integer("total_score").notNull(),
  passedFilters: integer("passed_filters", { mode: "boolean" }).notNull(),
  evaluationMode: text("evaluation_mode").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index("evaluations_listing_id_idx").on(table.listingId),
  index("evaluations_visitor_session_id_idx").on(table.visitorSessionId),
]);

export const evaluationRequests = sqliteTable("evaluation_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identityHash: text("identity_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("evaluation_requests_identity_created_idx").on(table.identityHash, table.createdAt),
]);
