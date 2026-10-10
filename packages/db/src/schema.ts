import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const competitionStatus = pgEnum("competition_status", ["draft", "published", "live", "paused", "completed", "cancelled"]);
export const entryStatus = pgEnum("entry_status", ["pending", "approved", "withdrawn", "disqualified"]);
export const roundStatus = pgEnum("round_status", ["scheduled", "live", "completed", "cancelled"]);
export const performanceStatus = pgEnum("performance_status", ["queued", "live", "completed", "skipped"]);
export const resultStatus = pgEnum("result_status", ["provisional", "final", "void"]);

export const engineMetadata = pgTable("engine_metadata", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const participants = pgTable("participants", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  displayName: text("display_name").notNull(),
  externalRef: text("external_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("participants_organization_idx").on(t.organizationId),
  uniqueIndex("participants_external_ref_uniq").on(t.organizationId, t.externalRef),
  uniqueIndex("participants_org_id_uniq").on(t.organizationId, t.id)
]);

export const competitions = pgTable("competitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  title: text("title").notNull(),
  description: text("description"),
  status: competitionStatus("status").notNull().default("draft"),
  rules: jsonb("rules").notNull().default({}),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  index("competitions_org_status_idx").on(t.organizationId, t.status),
  uniqueIndex("competitions_org_id_uniq").on(t.organizationId, t.id)
]);

export const entries = pgTable("entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  competitionId: uuid("competition_id").notNull(),
  participantId: uuid("participant_id").notNull(),
  status: entryStatus("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("entries_unique_participant").on(t.competitionId, t.participantId),
  index("entries_competition_status_idx").on(t.competitionId, t.status)
]);

export const rounds = pgTable("rounds", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  competitionId: uuid("competition_id").notNull(),
  label: text("label").notNull(),
  ordinal: integer("ordinal").notNull(),
  status: roundStatus("status").notNull().default("scheduled"),
  scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("rounds_unique_ordinal").on(t.competitionId, t.ordinal),
  uniqueIndex("rounds_competition_id_uniq").on(t.competitionId, t.id)
]);

export const performances = pgTable("performances", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  competitionId: uuid("competition_id").notNull(),
  roundId: uuid("round_id").notNull(),
  entryId: uuid("entry_id").notNull(),
  ordinal: integer("ordinal").notNull(),
  status: performanceStatus("status").notNull().default("queued"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  metadata: jsonb("metadata").notNull().default({})
}, (t) => [
  uniqueIndex("performances_unique_ordinal").on(t.roundId, t.ordinal),
  index("performances_round_status_idx").on(t.roundId, t.status)
]);

export const judges = pgTable("judges", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  displayName: text("display_name").notNull(),
  externalRef: text("external_ref"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("judges_organization_idx").on(t.organizationId)]);

export const competitionJudges = pgTable("competition_judges", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  competitionId: uuid("competition_id").notNull(),
  judgeId: uuid("judge_id").notNull()
}, (t) => [uniqueIndex("competition_judges_unique").on(t.competitionId, t.judgeId)]);

export const results = pgTable("results", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  competitionId: uuid("competition_id").notNull(),
  roundId: uuid("round_id"),
  entryId: uuid("entry_id").notNull(),
  rank: integer("rank"),
  score: text("score"),
  status: resultStatus("status").notNull().default("provisional"),
  details: jsonb("details").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [index("results_competition_idx").on(t.competitionId, t.status)]);
