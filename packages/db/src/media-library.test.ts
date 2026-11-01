import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { getSqlClient, closeDatabaseConnection } from "./index.ts";
import { storeMediaUpload, readMediaPlayback, revokeMedia, claimMediaWork, completeMediaWork, moderateMedia, listOwnedMedia, listMediaVersions } from "./media-library.ts";
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
  await assert.rejects(sql`INSERT INTO media_library_audit(organization_id,media_id,revision,action)
    VALUES(${other},${media.id},1,'reject')`,/foreign key/);
  await assert.rejects(sql`UPDATE media_versions SET organization_id=${other} WHERE media_id=${media.id}`,/foreign key/);
  await assert.rejects(sql`UPDATE media_versions SET source_mime='text/html' WHERE media_id=${media.id}`,/check constraint/);
  await assert.rejects(sql`UPDATE media_versions SET filename='../escape.png' WHERE media_id=${media.id}`,/check constraint/);
  await assert.rejects(sql`UPDATE media_versions SET status='ready' WHERE media_id=${media.id}`,/check constraint/);
  assert.equal((await listOwnedMedia(org,owner)).length,1);
  assert.equal((await listOwnedMedia(other,owner)).length,0);
  assert.equal((await listOwnedMedia(org,stranger)).length,0);
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
  const replacement=await storeMediaUpload({...upload,mediaId:media.id,expectedRevision:2});
  assert.equal(replacement.revision,3);
  assert.deepEqual((await listMediaVersions(org,owner,media.id)).items.map(v=>v.revision),[3,2,1]);
  assert.deepEqual((await listMediaVersions(org,owner,media.id,3)).items.map(v=>v.revision),[2,1]);
  assert.equal((await listMediaVersions(other,owner,media.id)).items.length,0);
  assert.equal((await listMediaVersions(org,stranger,media.id)).items.length,0);
  assert.equal(await completeMediaWork(renewed!,output),false);
  const superseded=await sql`SELECT status,source_content FROM media_versions WHERE media_id=${media.id} AND revision=2`;
  assert.equal(superseded[0]!.status,"revoked");assert.equal(superseded[0]!.source_content,null);
  const latest=await claimMediaWork();assert.equal(latest?.revision,3);
  assert.equal(await revokeMedia(org,stranger,media.id),false);
  assert.equal(await revokeMedia(other,owner,media.id),false);
  assert.equal(await revokeMedia(org,owner,media.id),true);
  assert.equal(await completeMediaWork(latest!,output),false);
  assert.equal(await readMediaPlayback(org,owner,media.id),null);
  assert.equal((await listMediaVersions(org,owner,media.id)).items.length,0);
  await assert.rejects(storeMediaUpload({...upload,mediaId:media.id,expectedRevision:3}),/MEDIA_REVISION_CONFLICT/);
  const second=await storeMediaUpload(upload);
  await assert.rejects(moderateMedia(org,stranger,second.id,"copyright"),/MEDIA_SCOPE_DENIED/);
  await sql`INSERT INTO role_grants(account_id,role,organization_id,granted_by_account_id)
    VALUES(${stranger},'tenant_operator',${org},${owner})`;
  await assert.rejects(moderateMedia(other,stranger,second.id,"copyright"),/MEDIA_SCOPE_DENIED/);
  assert.equal(await moderateMedia(org,stranger,second.id,"copyright"),true);
  assert.equal(await readMediaPlayback(org,owner,second.id),null);
  const moderation=await sql`SELECT action,reason_code FROM media_library_audit WHERE media_id=${second.id} AND action='moderate'`;
  assert.equal(moderation[0]!.reason_code,"copyright");
  const third=await storeMediaUpload(upload);
  await sql`UPDATE role_grants SET revoked_at=now() WHERE organization_id=${org} AND account_id=${stranger}`;
  await assert.rejects(moderateMedia(org,stranger,third.id,"safety"),/MEDIA_SCOPE_DENIED/);
  const unmoderated=await sql`SELECT status FROM media_versions WHERE media_id=${third.id}`;
  assert.equal(unmoderated[0]!.status,"quarantined");
  const versions=await sql`SELECT status,source_content,output_content FROM media_versions WHERE media_id=${media.id}`;
  assert.equal(versions.length,3);assert.ok(versions.every(v=>v.status==="revoked"&&v.source_content===null&&v.output_content===null));
  for(let i=1;i<100;i++)await storeMediaUpload(upload);
  assert.equal((await listOwnedMedia(org,owner)).length,100);
  await assert.rejects(storeMediaUpload(upload),/MEDIA_QUOTA_EXCEEDED/);
  assert.equal(await revokeMedia(org,owner,third.id),true);
  assert.equal((await storeMediaUpload(upload)).revision,1);
  await sql`UPDATE organization_memberships SET status='suspended',suspended_at=now() WHERE organization_id=${org} AND account_id=${owner}`;
  await assert.rejects(storeMediaUpload(upload),/MEDIA_SCOPE_DENIED/);
  const audit=await sql`SELECT action FROM media_library_audit WHERE media_id=${media.id}`;
  assert.ok(audit.some(a=>a.action==="upload"));assert.ok(audit.some(a=>a.action==="processed"));
  assert.ok(audit.some(a=>a.action==="playback"));assert.ok(audit.some(a=>a.action==="revoke"));
 }finally{
  await sql`DELETE FROM media_library_audit WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM media_versions WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM media_library WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM role_grants WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM organization_memberships WHERE organization_id IN (${org},${other})`;
  await sql`DELETE FROM accounts WHERE id IN (${owner},${stranger})`;
  await sql`DELETE FROM organizations WHERE id IN (${org},${other})`;
  await closeDatabaseConnection();
 }
});

