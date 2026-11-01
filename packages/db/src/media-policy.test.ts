import test from "node:test";
import assert from "node:assert/strict";
import { inspectMediaUpload, mediaUploadLimit, mediaRightsVersion, type MediaUpload } from "./media-policy.ts";
const id="11111111-1111-4111-8111-111111111111";
const valid: MediaUpload = { organizationId:id,ownerId:id,expectedRevision:0,kind:"image",mime:"image/png",
  filename:"fixture.png",rightsVersion:mediaRightsVersion,content:Buffer.from("89504e470d0a1a0a","hex") };
test("server computes digest and snapshots uploaded bytes",()=>{
  const source={...valid,content:new Uint8Array(valid.content)};
  const result=inspectMediaUpload(source); source.content[0]=0;
  assert.equal(result.sha256.length,64); assert.equal(result.content[0],137);
});
for(const update of [
  {rightsVersion:""}, {mime:"text/html"}, {filename:"../secret"}, {kind:"video",mime:"video/mp4"},
  {content:new Uint8Array()}, {content:new Uint8Array(mediaUploadLimit+1)}, {ownerId:"bad"},
  {expectedRevision:1}, {mediaId:id,expectedRevision:0}, {expectedRevision:NaN}
]) {
  test("invalid media upload remains rejected "+JSON.stringify({...update,content:update.content?"bytes":undefined}),()=>{
    assert.throws(()=>inspectMediaUpload({...valid,...update} as MediaUpload),/MEDIA_/);
  });
}
test("signature matching is not decoding or safety approval",()=>{
  assert.equal(inspectMediaUpload(valid).bytes,8); // worker must still reject this truncated PNG
});

