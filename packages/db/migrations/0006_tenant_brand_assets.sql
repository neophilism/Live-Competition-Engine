CREATE TABLE "organization_brand_assets" (
  "id" uuid PRIMARY KEY,
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "kind" text NOT NULL CHECK ("kind" = 'logo'),
  "content_type" text NOT NULL CHECK ("content_type" IN ('image/png', 'image/webp')),
  "byte_length" integer NOT NULL CHECK ("byte_length" BETWEEN 1 AND 524288),
  "sha256" char(64) NOT NULL CHECK ("sha256" ~ '^[0-9a-f]{64}$'),
  "content" bytea NOT NULL,
  "uploaded_by_account_id" uuid NOT NULL REFERENCES "accounts" ("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length("content") = "byte_length"),
  UNIQUE ("organization_id", "kind", "sha256")
);

CREATE INDEX "organization_brand_assets_org_created_idx"
  ON "organization_brand_assets" ("organization_id", "created_at");
