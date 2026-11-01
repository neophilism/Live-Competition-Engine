CREATE TABLE media_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  owner_account_id uuid NOT NULL,
  current_revision integer NOT NULL DEFAULT 1 CHECK (current_revision > 0),
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, id),
  FOREIGN KEY(organization_id, owner_account_id) REFERENCES organization_memberships(organization_id, account_id)
);
CREATE TABLE media_versions (
  media_id uuid NOT NULL,
  organization_id uuid NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  kind text NOT NULL CHECK (kind IN ('image','audio','video')),
  filename text NOT NULL CHECK (length(filename) BETWEEN 1 AND 160),
  source_mime text NOT NULL,
  source_sha256 char(64) NOT NULL,
  source_content bytea,
  rights_version text NOT NULL CHECK (rights_version = 'media-rights-v1'),
  rights_accepted_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'quarantined' CHECK (status IN ('quarantined','processing','ready','rejected','revoked')),
  worker_token uuid,
  worker_expires_at timestamptz,
  output_mime text,
  output_sha256 char(64),
  output_content bytea,
  safety_evidence text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(media_id, revision),
  FOREIGN KEY(organization_id, media_id) REFERENCES media_library(organization_id, id),
  CHECK (source_content IS NULL OR octet_length(source_content) BETWEEN 1 AND 8388608),
  CHECK (output_content IS NULL OR octet_length(output_content) BETWEEN 1 AND 8388608),
  CHECK (status <> 'ready' OR (output_content IS NOT NULL AND output_mime IS NOT NULL AND output_sha256 IS NOT NULL AND safety_evidence IS NOT NULL)),
  CHECK (status <> 'processing' OR (worker_token IS NOT NULL AND worker_expires_at IS NOT NULL))
);
CREATE INDEX media_versions_work_idx ON media_versions(status, created_at);
CREATE TABLE media_library_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  media_id uuid NOT NULL,
  revision integer NOT NULL,
  actor_account_id uuid REFERENCES accounts(id),
  action text NOT NULL CHECK(action IN ('upload','processed','reject','revoke','playback','moderate')),
  reason_code text CHECK(reason_code IN ('copyright','safety','consent')),
  CHECK(action <> 'moderate' OR (reason_code IS NOT NULL AND actor_account_id IS NOT NULL)),
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(media_id, revision) REFERENCES media_versions(media_id, revision)
);

