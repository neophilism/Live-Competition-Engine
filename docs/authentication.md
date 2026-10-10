# Authentication and identity

LC-03 establishes a framework-neutral authentication boundary. Accounts can link
verified external identities without storing provider credentials. API callers
receive 256-bit opaque bearer tokens; only domain-separated SHA-256 digests are
persisted. Sessions expire, can be individually revoked, and are invalidated as
a group when recovery increments the account recovery epoch.

Recovery codes are random, one-time values shown only at issuance. A database
adapter must consume a recovery digest, increment the recovery epoch, mark the
code used and revoke active sessions in one transaction. The service deliberately
models that operation as one store method so adapters cannot partially recover an
account. Codes and raw session tokens must never be logged.

Authorization can bind a request to an active organization membership. Missing,
malformed, expired, revoked, recovered or cross-organization credentials fail
closed. LC-04 will add roles and action permissions; membership in LC-03 grants
no role by itself. Interactive provider callbacks, email delivery and production
rate limiting require deployed-provider evidence and are not claimed here.
