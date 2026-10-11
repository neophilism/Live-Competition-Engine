CREATE TABLE "organization_theme_versions" (
  "organization_id" uuid NOT NULL REFERENCES "organizations" ("id") ON DELETE CASCADE,
  "revision" integer NOT NULL CHECK ("revision" > 0),
  "is_active" boolean NOT NULL DEFAULT false,
  "logo_path" text,
  "primary_color" varchar(7) NOT NULL,
  "surface_color" varchar(7) NOT NULL,
  "text_color" varchar(7) NOT NULL,
  "accent_color" varchar(7) NOT NULL,
  "typography" text NOT NULL CHECK ("typography" IN ('system','humanist','geometric')),
  "template" text NOT NULL CHECK ("template" IN ('editorial','broadcast','compact')),
  "navigation" jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof("navigation") = 'array'),
  "updated_by_account_id" uuid NOT NULL REFERENCES "accounts" ("id"),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("organization_id", "revision"),
  CHECK ("logo_path" IS NULL OR (
    left("logo_path",1)='/' AND left("logo_path",2)<>'//' AND position(':' in "logo_path")=0
  )),
  CHECK ("primary_color" ~ '^#[0-9A-Fa-f]{6}$'),
  CHECK ("surface_color" ~ '^#[0-9A-Fa-f]{6}$'),
  CHECK ("text_color" ~ '^#[0-9A-Fa-f]{6}$'),
  CHECK ("accent_color" ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE UNIQUE INDEX "organization_theme_versions_one_active"
  ON "organization_theme_versions" ("organization_id") WHERE "is_active";
