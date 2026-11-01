import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getSqlClient, closeDatabaseConnection } from "./index.ts";
import { storeMediaUpload, readMediaPlayback, revokeMedia, claimMediaWork, completeMediaWork } from "./media-library.ts";
import { mediaRightsVersion } from "./media-policy.ts";

test("media persistence isolates tenants/owners, versions atomically and fences stale workers/revocation", async()=>{
 const sql=getSqlClient();
 const org=randomUUID(),other=randomUUID(),owner=randomUUID(),stranger=randomUUID();
 const upload={organizationId:org,ownerId:owner,expectedRevision:0,kind:"image" as const,mime:"image/png",
  filename:"fixture.png",rightsVersion:mediaRightsVersion,content:Buffer.from("89504e470d0a1a0a","hex")};
 const output={mime:"image/jpeg" as const,content:new Uint8Array([255,216,255]),safetyEvidence:"test fixture only; not production safety approval"};
 try{
  await sql`INSERT INTO organizations(id,name,slug) VALUES(${org},'Media fixture',${org}),(${other},'Other fixture',${other})`;
  await sql`INSERT INTO accounts(id) VALUES(${owner}),(${stranger})`;
  await sql`INSERT INTO organization_memberships(organization_id,account_id)
    VALUES(${org},${owner}),(${org},${stranger}),(${other},${owner})`;
  const media=await storeMediaUpload(upload);
  assert.equal(media.revision,1);
  assert.equal(await readMediaPlayback(org,owner,media.id),null);
  assert.equal(await readMediaPlayback(org,stranger,media.id),null);
  assert.equal(await readMediaPlayback(other,owner,media.id),null);
  const work=await claimMediaWork();assert.equal(work?.id,media.id);
  assert.equal(await completeMediaWork({...work!,token:randomUUID()},output),false);
  assert.equal(await completeMediaWork(work!,output),true);
  assert.equal(await completeMediaWork(work!,output),false);
  assert.deepEqual((await readMediaPlayback(org,owner,media.id))?.content,output.content);
  const original=await sql`SELECT source_content FROM media_versions WHERE media_id=${media.id}`;
  assert.equal(original[0]!.source_content,null);
  await assert.rejects(storeMediaUpload({...upload,mediaId:media.id,ownerId:stranger,expectedRevision:1}),/MEDIA_REVISION_CONFLICT/);
  const attempts=await Promise.allSettled([
    storeMediaUpload({...upload,mediaId:media.id,expectedRevision:1}),
    storeMediaUpload({...upload,mediaId:media.id,expectedRevision:1})
  ]);
  assert.equal(attempts.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(attempts.filter(x=>x.status==="rejected").length,1);
  assert.equal(await readMediaPlayback(org,owner,media.id),null); // newest revision quarantined
  const firstLease=await claimMediaWork();assert.equal(firstLease?.revision,2);
  await sql`UPDATE media_versions SET worker_expires_at=now()-interval '1 second' WHERE media_id=${media.id} AND revision=2`;
  const renewed=await claimMediaWork();assert.equal(renewed?.revision,2);assert.notEqual(renewed?.token,firstLease?.token);
  assert.equal(await completeMediaWork(firstLease!,output),false);
  assert.equal(await revokeMedia(org,stranger,media.id),false);
  assert.equal(await revokeMedia(other,owner,media.id),false);
  assert.equal(await revokeMedia(org,owner,media.id),true);
  assert.equal(await completeMediaWork(renewed!,output),false);
  assert.equal(await readMediaPlayback(org,owner,media.id),null);
  await assert.rejects(storeMediaUpload({...upload,mediaId:media.id,expectedRevision:2}),/MEDIA_REVISION_CONFLICT/);
  const versions=await sql`SELECT status,source_content,output_content FROM media_versions WHERE media_id=${media.id}`;
  assert.equal(versions.length,2);assert.ok(versions.every(v=>v.status==="revoked"&&v.source_content===null&&v.output_content===null));
  await sql`UPDATE organization_memberships SET suspended_at=now() WHERE organization_id=${org} AND account_id=${owner}`;
  await assert.rejects(storeMediaUpload(upload),/MEDIA_SCOPE_DENIED/);
  const audit=await sql`SELECT action FROM media_library_audit WHERE media_id=${media.id}`;
  assert.ok(audit.some(a=>a.action==="upload"));assert.ok(audit.some(a=>a.action==="processed"));
  assert.ok(audit.some(a=>a.action==="playback"));assert.ok(audit.some(a=>a.action==="revoke"));
 }finally{
  await sql`DELETE FROM media_library_audit WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM media_versions WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM media_library WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM organization_memberships WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM accounts WHERE id IN (${owner},${stranger})`;
  await sql`DELETE FROM organizations WHERE id IN (${org},${other})`;
  await closeDatabaseConnection();
 }
});

