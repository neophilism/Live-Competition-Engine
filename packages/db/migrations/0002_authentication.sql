CREATE TABLE "accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" text UNIQUE,
  "recovery_epoch" integer NOT NULL DEFAULT 0 CHECK ("recovery_epoch" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "disabled_at" timestamptz,
  CHECK ("email" IS NULL OR ("email" = lower(btrim("email")) AND length("email") BETWEEN 3 AND 320))
);
CREATE TABLE "account_identities" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "provider" text NOT NULL CHECK ("provider" ~ '^[a-z][a-z0-9_-]{1,31}$'),
  "issuer" text NOT NULL CHECK (length("issuer") BETWEEN 1 AND 2048),
  "subject" text NOT NULL CHECK (length("subject") BETWEEN 1 AND 512),
  "verified_at" timestamptz NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("provider", "issuer", "subject")
);
CREATE INDEX "account_identities_account_idx" ON "account_identities" ("account_id");
CREATE TABLE "organization_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" uuid NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'active' CHECK ("status" IN ('active','suspended')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "suspended_at" timestamptz,
  UNIQUE ("organization_id", "account_id"),
  CHECK (("status" = 'suspended') = ("suspended_at" IS NOT NULL))
);
CREATE INDEX "organization_memberships_account_idx" ON "organization_memberships" ("account_id", "status");
CREATE TABLE "auth_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  "recovery_epoch" integer NOT NULL CHECK ("recovery_epoch" >= 0),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz NOT NULL DEFAULT now(),
  "revoked_at" timestamptz,
  CHECK ("expires_at" > "created_at")
);
CREATE INDEX "auth_sessions_account_active_idx" ON "auth_sessions" ("account_id", "expires_at") WHERE "revoked_at" IS NULL;
CREATE TABLE "account_recovery_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "code_hash" text NOT NULL CHECK ("code_hash" ~ '^[0-9a-f]{64}$'),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "used_at" timestamptz,
  UNIQUE ("account_id", "code_hash"),
  CHECK ("expires_at" > "created_at")
);
CREATE INDEX "account_recovery_codes_account_idx" ON "account_recovery_codes" ("account_id", "expires_at");
