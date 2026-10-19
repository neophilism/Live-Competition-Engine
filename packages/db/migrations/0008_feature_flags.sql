CREATE TABLE feature_flags (
  scope_key text NOT NULL,
  feature text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('platform', 'tenant', 'event', 'account')),
  organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  event_id uuid,
  account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL,
  revision integer NOT NULL CHECK (revision > 0),
  updated_by_account_id uuid NOT NULL REFERENCES accounts(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope_key, feature),
  CHECK (
    (scope = 'platform' AND scope_key = 'platform' AND organization_id IS NULL AND event_id IS NULL AND account_id IS NULL) OR
    (scope = 'tenant' AND scope_key = 'tenant:' || organization_id::text AND organization_id IS NOT NULL AND event_id IS NULL AND account_id IS NULL) OR
    (scope = 'event' AND scope_key = 'event:' || event_id::text AND organization_id IS NOT NULL AND event_id IS NOT NULL AND account_id IS NULL) OR
    (scope = 'account' AND scope_key = 'account:' || organization_id::text || ':' || account_id::text AND organization_id IS NOT NULL AND event_id IS NULL AND account_id IS NOT NULL)
  ),
  FOREIGN KEY (organization_id, event_id) REFERENCES competitions(organization_id, id)
);

CREATE INDEX feature_flags_organization_idx ON feature_flags (organization_id, scope, feature);

CREATE TABLE feature_decision_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  feature text NOT NULL,
  organization_id uuid NOT NULL REFERENCES organizations(id),
  event_id uuid,
  account_id uuid,
  enabled boolean NOT NULL,
  reason text NOT NULL,
  controlling_scope text NOT NULL,
  policy_revisions jsonb NOT NULL,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id, event_id) REFERENCES competitions(organization_id, id)
);

CREATE INDEX feature_decision_audit_organization_time_idx
  ON feature_decision_audit (organization_id, evaluated_at DESC);
