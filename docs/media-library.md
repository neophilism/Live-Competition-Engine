# Private versioned media library (LC-11)

This implementation stores bounded private media in PostgreSQL. It does not provision
object storage or purchase a service. Each upload is limited to 8 MiB; a tenant
has a serialized 128 MiB payload quota and at most 256 retained payload versions.
Each owner can keep at most 100 nonwithdrawn items; listing returns that complete
bounded collection. Withdrawing an item frees its item quota.
Rejected and revoked payloads do not consume the version quota.

An active tenant member uploads only as their authenticated account:
`POST /api/organizations/{organizationId}/media` with the raw bytes and headers:

- `Content-Type`: allowed image, video or audio type
- `X-Media-Kind`: image, video or audio
- `X-Media-Filename`: a plain bounded filename
- `X-Media-Rights-Version: media-rights-v1`: explicit attestation that the uploader
  owns or has permission to store/process this media and has required participant
  consent. Clients must present this statement and obtain an affirmative action.

Successful upload returns 202 and a quarantined media ID/revision, never public access.
Replace with POST to `.../media/{mediaId}` and `If-Match: {currentRevision}`.
Concurrent stale replacements fail. Every revision retains the consent version
and acceptance time. Superseded pending originals are erased and their workers
fenced immediately; completed historical derivatives remain private until withdrawal.
Ownership is derived from the session, never client IDs.
The server computes the digest and validates size, filename and binary signature.
A matching signature is not content safety approval.

GET on the item returns only its current approved derivative to its owner,
and GET on its /versions endpoint returns bounded owner-only metadata history
with an exclusive numeric before cursor. It never exposes old source payloads.
Both recheck active membership. Originals are never served. Responses are private,
no-store, nosniff and sandboxed. DELETE withdraws consent, revokes every revision,
erases source/derivative payloads, and fences in-flight workers. Previously
downloaded copies cannot be recalled. Upload, processing, playback and withdrawal
write a durable audit record in their database transaction.

Trusted worker integration uses `claimMediaWork`, `processOneMediaJob` and
`completeMediaWork`. Five-minute worker leases use unpredictable tokens.
Expired work can be reclaimed; stale tokens, replaced revisions and withdrawal
cannot publish. Invalid content is rejected. Infrastructure failure retains
quarantine for recovery. Transcoding uses a shell-free, fixed FFmpeg argument
list, pipe-only protocols, stripped metadata, bounded output, one encoder thread,
allocation limits and a 30-second process timeout. Deploy the worker in an
isolated environment without network/application credentials; the orchestrator
should pass only bounded job data and completed results across that boundary.
Artwork derivatives are at most 640 pixels per side; video is at most 1280x720
and 60 seconds; audio is at most five minutes.

A trusted safety reviewer must approve both original and derivative and supply
bounded evidence before ready status. **No production safety reviewer is wired
or claimed here.** Fixture review responses are test-only. Never use a permanent
allow-all reviewer. No public publication, monetization or copyright certification
is implied by private playback. A UI, production worker isolation/reviewer
integration remain unfinished acceptance work. The included reusable MediaLibrary
component and createMediaClient adapter support uploads with affirmative rights
consent, status, authenticated blob previews and withdrawal. A downstream signed-in
host supplies a fresh authorization callback; no session token is stored in the
component or placed in URLs. The engine's application shell does not yet expose a
signed-in identity flow for mounting it. Full browser acceptance remains pending.

Tenant operators can POST a bounded reason code (copyright, safety or consent) to
the item moderation endpoint. The API checks tenant.manage and storage rechecks
the active unrevoked tenant-operator grant in the same transaction before erasing
payloads and recording takedown evidence. Ordinary members cannot take down
another account's files. Moderation does not expose source or derivative bytes.

Verification includes Node policy/HTTP/worker tests, generated local FFmpeg
fixtures, and PostgreSQL integration tests for isolation, concurrent revisions,
lease recovery, revocation and audit. The optional FFmpeg fixture test explicitly
skips if the binary is absent; a skipped test is not transcoding acceptance.

