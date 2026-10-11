# Tenant isolation

LC-05 establishes one tenant key: `organization_id`. Every tenant-owned row carries it, and relationships between tenant-owned records use composite foreign keys that include it. A record identifier alone is never sufficient authority to cross a tenant boundary.

API code must authenticate the account, verify active membership, and authorize the requested action against the same organization before querying data. The authentication package fails closed for cross-organization and cross-competition scopes. Database constraints independently reject mismatched entries, rounds, judges, performances, and results.

Future media, payment, reporting, and tenant-configuration tables must follow the same rule: include `organization_id`, use composite references for tenant-owned relationships, and add an integration test that attempts a cross-tenant write. Public projections remain explicit outputs; a public identifier does not weaken write isolation.
