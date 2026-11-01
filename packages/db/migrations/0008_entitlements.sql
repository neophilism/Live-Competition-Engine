CREATE TABLE entitlement_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version integer NOT NULL DEFAULT 1 CHECK (version = 1),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  event_id uuid,
  capability text NOT NULL CHECK (capability IN ('event.view','event.enter','content.view','staff.operate')),
  source text NOT NULL CHECK (source IN ('ticket','subscription','staff','manual')),
  status text NOT NULL CHECK (status IN ('active','pending','refunded','revoked')),
  starts_at bigint NOT NULL CHECK (starts_at BETWEEN 0 AND 9007199254740991),
  expires_at bigint CHECK (expires_at > starts_at AND expires_at <= 9007199254740991),
  CHECK (source <> 'ticket' OR event_id IS NOT NULL),
  CHECK ((source = 'staff') = (capability = 'staff.operate')),
  FOREIGN KEY (organization_id, event_id) REFERENCES competitions(organization_id, id),
  FOREIGN KEY (organization_id, account_id) REFERENCES organization_memberships(organization_id, account_id)
);
CREATE INDEX entitlement_grants_subject_idx ON entitlement_grants(organization_id, account_id);
CREATE TABLE entitlement_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  account_id uuid NOT NULL REFERENCES accounts(id),
  event_id uuid,
  capability text NOT NULL,
  allowed boolean NOT NULL,
  reason text NOT NULL,
  evaluated_at bigint NOT NULL,
  grant_id uuid REFERENCES entitlement_grants(id),
  grant_version integer,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, event_id) REFERENCES competitions(organization_id, id)
);
CREATE INDEX entitlement_decisions_subject_idx ON entitlement_decisions(organization_id, account_id, recorded_at);
