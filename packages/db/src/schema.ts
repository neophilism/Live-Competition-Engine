import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const competitionStatus = pgEnum("competition_status", ["draft", "published", "live", "paused", "completed", "cancelled"]);
export const entryStatus = pgEnum("entry_status", ["pending", "approved", "withdrawn", "disqualified"]);
export const roundStatus = pgEnum("round_status", ["scheduled", "live", "completed", "cancelled"]);
export const performanceStatus = pgEnum("performance_status", ["queued", "live", "completed", "skipped"]);
export const resultStatus = pgEnum("result_status", ["provisional", "final", "void"]);\nexport const competitionRole = pgEnum("competition_role", [\n  "platform_operator",\n  "tenant_operator",\n  "event_producer",\n  "performer",\n  "judge",\n  "viewer",\n  "industry_scout"\n]);

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


export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  recoveryEpoch: integer("recovery_epoch").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  disabledAt: timestamp("disabled_at", { withTimezone: true })
});

export const accountIdentities = pgTable("account_identities", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  provider: text("provider").notNull(),
  issuer: text("issuer").notNull(),
  subject: text("subject").notNull(),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
}, (t) => [
  uniqueIndex("account_identities_subject_uniq").on(t.provider, t.issuer, t.subject),
  index("account_identities_account_idx").on(t.accountId)
]);

export const organizationMemberships = pgTable("organization_memberships", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id").notNull().references(() => organizations.id),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  suspendedAt: timestamp("suspended_at", { withTimezone: true })
}, (t) => [
  uniqueIndex("organization_memberships_account_uniq").on(t.organizationId, t.accountId),
  index("organization_memberships_account_idx").on(t.accountId, t.status)
]);

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  tokenHash: text("token_hash").notNull().unique(),
  recoveryEpoch: integer("recovery_epoch").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (t) => [index("auth_sessions_account_active_idx").on(t.accountId, t.expiresAt)]);

export const accountRecoveryCodes = pgTable("account_recovery_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  codeHash: text("code_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true })
}, (t) => [
  uniqueIndex("account_recovery_codes_hash_uniq").on(t.accountId, t.codeHash),
  index("account_recovery_codes_account_idx").on(t.accountId, t.expiresAt)
]);


export const roleGrants = pgTable("role_grants", {
  id: uuid("id").primaryKey().defaultRandom(),
  accountId: uuid("account_id").notNull().references(() => accounts.id),
  role: competitionRole("role").notNull(),
  version: integer("version").notNull().default(1),
  organizationId: uuid("organization_id").references(() => organizations.id),
  competitionId: uuid("competition_id").references(() => competitions.id),
  grantedByAccountId: uuid("granted_by_account_id").notNull().references(() => accounts.id),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true })
}, (t) => [
  index("role_grants_account_active_idx").on(t.accountId, t.revokedAt),
  index("role_grants_organization_idx").on(t.organizationId, t.role),
  index("role_grants_competition_idx").on(t.competitionId, t.role)
]);
