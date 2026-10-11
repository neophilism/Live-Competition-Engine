CREATE TYPE "competition_role" AS ENUM (
  'platform_operator',
  'tenant_operator',
  'event_producer',
  'performer',
  'judge',
  'viewer',
  'industry_scout'
);

CREATE TABLE "role_grants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "account_id" uuid NOT NULL REFERENCES "accounts"("id") ON DELETE CASCADE,
  "role" "competition_role" NOT NULL,
  "version" integer NOT NULL DEFAULT 1 CHECK ("version" = 1),
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE CASCADE,
  "competition_id" uuid,
  "granted_by_account_id" uuid NOT NULL REFERENCES "accounts"("id"),
  "granted_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz,
  "revoked_at" timestamptz,
  CHECK ("expires_at" IS NULL OR "expires_at" > "granted_at"),
  CHECK (
    ("role" = 'platform_operator' AND "organization_id" IS NULL AND "competition_id" IS NULL)
    OR
    ("role" IN ('tenant_operator', 'viewer', 'industry_scout') AND "organization_id" IS NOT NULL AND "competition_id" IS NULL)
    OR
    ("role" IN ('event_producer', 'performer', 'judge') AND "organization_id" IS NOT NULL AND "competition_id" IS NOT NULL)
  ),
  FOREIGN KEY ("organization_id", "account_id")
    REFERENCES "organization_memberships" ("organization_id", "account_id") ON DELETE CASCADE,
  FOREIGN KEY ("organization_id", "competition_id")
    REFERENCES "competitions" ("organization_id", "id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX "role_grants_one_active_scope_uniq" ON "role_grants" (
  "account_id",
  "role",
  coalesce("organization_id", '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce("competition_id", '00000000-0000-0000-0000-000000000000'::uuid)
) WHERE "revoked_at" IS NULL;
CREATE INDEX "role_grants_account_active_idx" ON "role_grants" ("account_id", "revoked_at");
CREATE INDEX "role_grants_organization_idx" ON "role_grants" ("organization_id", "role");
CREATE INDEX "role_grants_competition_idx" ON "role_grants" ("competition_id", "role");
