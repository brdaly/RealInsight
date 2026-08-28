import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const evaluationRequests = sqliteTable("evaluation_requests", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identityHash: text("identity_hash").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  index("evaluation_requests_identity_created_idx").on(table.identityHash, table.createdAt),
]);
