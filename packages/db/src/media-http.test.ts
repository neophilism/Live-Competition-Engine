import test from "node:test";
import assert from "node:assert/strict";
import { AuthenticationError } from "@live-competition-engine/auth";
import { createMediaHandlers } from "./media-http.ts";
import { mediaRightsVersion, mediaUploadLimit, type MediaUpload } from "./media-policy.ts";
const org="11111111-1111-4111-8111-111111111111", account="22222222-2222-4222-8222-222222222222", id="33333333-3333-4333-8333-333333333333";
function request(extra:Record<string,string>={},body:BodyInit=new Uint8Array([1])) {
  return new Request("https://engine.example/media",{method:"POST",headers:{
    authorization:"Bearer fixture","content-type":"image/png","x-media-kind":"image",
    "x-media-filename":"fixture.png","x-media-rights-version":mediaRightsVersion,...extra},body});
}
function fixture() {
 const state={authCode:"" as ""|"missing"|"revoked"|"forbidden",uploads:[] as MediaUpload[],
   reads:0,revokes:0,missing:false,error:"",tenant:org};
 const handlers=createMediaHandlers({async authorize(_header,organizationId){
   assert.equal(organizationId,org);
   if(state.authCode)throw new AuthenticationError(state.authCode);
   return {organizationId:state.tenant,accountId:account,sessionId:id};
 }},{
   async upload(input){if(state.error)throw new Error(state.error);state.uploads.push(input);return{id,revision:input.expectedRevision+1};},
   async playback(organizationId,ownerId,mediaId){
     state.reads++;assert.deepEqual([organizationId,ownerId,mediaId],[org,account,id]);
     if(state.error)throw new Error(state.error);
     return state.missing?null:{mime:"image/jpeg",content:new Uint8Array([255,216,255]),revision:1};
   },
   async revoke(organizationId,ownerId,mediaId){
     state.revokes++;assert.deepEqual([organizationId,ownerId,mediaId],[org,account,id]);
     if(state.error)throw new Error(state.error);return !state.missing;
   }
 });return{state,handlers};
}
test("media upload derives ownership, requires rights and returns quarantined revision",async()=>{
 const {state,handlers}=fixture();const response=await handlers.upload(request(),org);
 assert.equal(response.status,202);assert.deepEqual(await response.json(),{id,revision:1,status:"quarantined"});
 assert.equal(state.uploads[0]!.ownerId,account);assert.equal(state.uploads[0]!.organizationId,org);
 assert.equal(response.headers.get("cache-control"),"private, no-store");
});
test("media replacement carries compare-and-swap revision",async()=>{
 const {state,handlers}=fixture();assert.equal((await handlers.upload(request({"if-match":"1"}),org,id)).status,202);
 assert.equal(state.uploads[0]!.expectedRevision,1);assert.equal(state.uploads[0]!.mediaId,id);
 assert.equal((await handlers.upload(request(),org,id)).status,409);
 assert.equal((await handlers.upload(request({"if-match":"1"}),org)).status,409);
});
for(const code of ["missing","revoked","forbidden"] as const) {
 test("media routes reject "+code+" before storage",async()=>{
   const {state,handlers}=fixture();state.authCode=code;
   for(const response of [await handlers.upload(request(),org),await handlers.playback(request(),org,id),await handlers.revoke(request(),org,id)]){
    assert.equal(response.status,code==="forbidden"?403:401);assert.match(response.headers.get("cache-control")!,/no-store/);
   }
   assert.equal(state.uploads.length+state.reads+state.revokes,0);
 });
}
test("media rejects mismatched tenant adapter and malformed IDs",async()=>{
 const {state,handlers}=fixture();state.tenant=account;
 assert.equal((await handlers.upload(request(),org)).status,403);
 assert.equal((await handlers.playback(request(),org,"bad")).status,400);
 assert.equal(state.uploads.length+state.reads,0);
});
test("media upload cannot omit rights or exceed actual/declared byte bound",async()=>{
 const {state,handlers}=fixture();
 assert.equal((await handlers.upload(request({"x-media-rights-version":""}),org)).status,400);
 assert.equal((await handlers.upload(request({"content-length":String(mediaUploadLimit+1)}),org)).status,413);
 assert.equal((await handlers.upload(request({"content-length":"2"}),org)).status,413);
 assert.equal((await handlers.upload(request({},new Uint8Array(mediaUploadLimit+1)),org)).status,413);
 assert.equal(state.uploads.length,0);
});
test("media playback returns only private derivative with defensive headers",async()=>{
 const {handlers}=fixture();const response=await handlers.playback(request(),org,id);
 assert.equal(response.status,200);assert.equal(response.headers.get("content-type"),"image/jpeg");
 assert.equal(response.headers.get("x-content-type-options"),"nosniff");
 assert.equal(response.headers.get("content-security-policy"),"default-src 'none'; sandbox");
 assert.deepEqual(new Uint8Array(await response.arrayBuffer()),new Uint8Array([255,216,255]));
});
test("missing/quarantined/revoked media is not playable and withdrawal is owner scoped",async()=>{
 const {state,handlers}=fixture();state.missing=true;
 assert.equal((await handlers.playback(request(),org,id)).status,404);
 assert.equal((await handlers.revoke(request(),org,id)).status,404);
 state.missing=false;assert.equal((await handlers.revoke(request(),org,id)).status,204);
});
for(const [error,status] of [["MEDIA_REVISION_CONFLICT",409],["MEDIA_QUOTA_EXCEEDED",409],["MEDIA_SCOPE_DENIED",403],["MEDIA_CONTENT_MISMATCH",400],["private database detail",503]] as const){
 test("media upload maps "+error+" without exposing internals",async()=>{
  const {state,handlers}=fixture();state.error=error;const response=await handlers.upload(request(),org);
  assert.equal(response.status,status);assert.equal(JSON.stringify(await response.json()).includes("private database"),false);
 });
}
test("media playback/revoke storage failures remain generic",async()=>{
 const {state,handlers}=fixture();state.error="private database detail";
 for(const response of [await handlers.playback(request(),org,id),await handlers.revoke(request(),org,id)]){
  assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:"media_unavailable"});
 }
});

