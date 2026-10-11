CREATE TABLE "organization_domains" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "domain" varchar(253) NOT NULL UNIQUE,
  "status" text NOT NULL DEFAULT 'pending' CHECK ("status" IN ('pending', 'verified', 'disabled')),
  "verification_token_hash" char(64) NOT NULL CHECK ("verification_token_hash" ~ '^[0-9a-f]{64}$'),
  "challenge_created_at" timestamptz NOT NULL DEFAULT now(),
  "claimed_by_account_id" uuid NOT NULL REFERENCES "accounts" ("id"),
  "verified_by_account_id" uuid REFERENCES "accounts" ("id"),
  "verified_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CHECK ("domain" = lower("domain")),
  CHECK ("status" <> 'verified' OR ("verified_at" IS NOT NULL AND "verified_by_account_id" IS NOT NULL))
);

CREATE INDEX "organization_domains_org_status_idx"
  ON "organization_domains" ("organization_id", "status");
